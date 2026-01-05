import OpenAI from "openai";
import { storage } from './storage';
import { sendWhatsAppMessage, isWhatsAppConfigured } from './whatsapp-service';
import type { WhatsappConversation, InsertExpenseReimbursement, InsertLeaveRequest } from '@shared/schema';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface IntentContext {
  amount?: number;
  purpose?: string;
  mediaUrl?: string;
  startDate?: string;
  endDate?: string;
  leaveType?: string;
  reason?: string;
  confirmed?: boolean;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const OAKSY_SYSTEM_PROMPT = `You are Oaksy AI, a friendly and helpful HR companion for Oakstreet Events employees via WhatsApp. You help employees with:

1. EXPENSE SUBMISSIONS: When employees share amounts (like "Rs.200", "₹500", "200", "1500/-") or describe expenses
2. LEAVE REQUESTS: When employees mention "leave", "sick", "vacation", "time off", "holiday", etc.
3. STATUS CHECKS: When employees ask about their pending requests

PERSONALITY:
- Warm, friendly, and supportive like a helpful colleague
- Use simple language, occasionally with emojis
- Be concise - this is WhatsApp, not email
- Always acknowledge their message first

IMPORTANT RULES:
1. When you detect an expense amount, ask what it's for
2. When you detect a leave request, ask for dates and reason
3. Always confirm before submitting: "Should I send this for approval?"
4. After submission: "Thank you! I'll send this for approval. Sit back and relax 🌳"
5. Keep responses short and conversational

RESPONSE FORMAT - Always respond with valid JSON:
{
  "intent": "expense" | "leave" | "status" | "greeting" | "confirmation" | "general",
  "extractedData": {
    "amount": number or null,
    "purpose": string or null,
    "leaveType": "sick" | "casual" | "vacation" | "personal" | null,
    "startDate": "DD/MM/YYYY" or null,
    "endDate": "DD/MM/YYYY" or null,
    "reason": string or null
  },
  "needsMoreInfo": ["purpose", "amount", "dates", "reason", "confirmation"] or [],
  "isComplete": boolean,
  "message": "Your friendly response to the user"
}`;

function normalizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[^0-9+]/g, '');
  cleaned = cleaned.replace(/^whatsapp:/i, '');
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return '+' + cleaned;
  }
  if (cleaned.length === 10) {
    return '+91' + cleaned;
  }
  return '+' + cleaned;
}

function extractAmount(text: string): number | null {
  const patterns = [
    /(?:Rs\.?|₹|INR)\s*([0-9,]+(?:\.[0-9]+)?)/i,
    /([0-9,]+(?:\.[0-9]+)?)\s*(?:Rs\.?|₹|INR|rupees?)/i,
    /([0-9,]+(?:\.[0-9]+)?)\s*\/-/,
    /^([0-9,]+(?:\.[0-9]+)?)$/,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (amount > 0 && amount < 10000000) {
        return amount;
      }
    }
  }
  return null;
}

function parseDate(text: string): string | null {
  const patterns = [
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
    /(\d{1,2})\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{2,4})?/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  return null;
}

async function analyzeWithAI(
  message: string,
  context: IntentContext,
  conversationHistory: ConversationMessage[],
  hasMedia: boolean
): Promise<{
  intent: string;
  extractedData: Partial<IntentContext>;
  needsMoreInfo: string[];
  isComplete: boolean;
  message: string;
}> {
  const recentHistory = conversationHistory.slice(-6);
  
  const historyText = recentHistory.map(m => 
    `${m.role === 'user' ? 'Employee' : 'Oaksy'}: ${m.content}`
  ).join('\n');

  const currentContext = context ? JSON.stringify(context) : '{}';
  
  const userPrompt = `Current conversation context: ${currentContext}
Has receipt/image attached: ${hasMedia ? 'Yes' : 'No'}

Recent conversation:
${historyText}

New message from employee: "${message}"

Analyze this message and respond as Oaksy AI. Remember to be friendly and helpful.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: OAKSY_SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || '';
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return {
      intent: 'general',
      extractedData: {},
      needsMoreInfo: [],
      isComplete: false,
      message: content || "Hi! I'm Oaksy, your HR companion. How can I help you today? 🌳"
    };
  } catch (error: any) {
    console.error('[Oaksy AI] Error:', error.message);
    return {
      intent: 'general',
      extractedData: {},
      needsMoreInfo: [],
      isComplete: false,
      message: "Hi! I'm Oaksy, your HR companion at Oakstreet Events. I can help you submit expenses or apply for leave. Just tell me what you need! 🌳"
    };
  }
}

async function getSuperadminPhone(): Promise<string> {
  const superadmins = await storage.getUsersByRole('superadmin');
  for (const user of superadmins) {
    const employee = await storage.getEmployeeByUserId(user.id);
    if (employee?.phone) {
      return employee.phone;
    }
  }
  return process.env.SUPERADMIN_WHATSAPP || '';
}

function generateUniqueApprovalCode(prefix: string): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 4).toUpperCase();
  return `${prefix}${timestamp.slice(-4)}${random}`;
}

async function createExpenseRequest(
  employeeId: string,
  employeeName: string,
  purpose: string,
  amount: number,
  mediaUrl?: string
): Promise<{ approvalCode: string; requestId: string }> {
  const approvalCode = generateUniqueApprovalCode('EXP');

  const expenseData: InsertExpenseReimbursement = {
    employeeId,
    date: new Date().toISOString().split('T')[0],
    purpose,
    amount: amount.toString(),
    status: 'pending',
    receiptUrl: mediaUrl || null,
    submittedVia: 'whatsapp',
  };

  const expense = await storage.createExpenseReimbursement(expenseData);
  const superadminPhone = await getSuperadminPhone();

  await storage.createWhatsappPendingApproval({
    approvalCode,
    type: 'expense',
    requestId: expense.id,
    employeeId,
    employeeName,
    description: purpose,
    amount: amount.toString(),
    mediaUrl: mediaUrl || null,
    status: 'pending',
    approverPhone: superadminPhone,
  });

  return { approvalCode, requestId: expense.id };
}

async function createLeaveRequest(
  employeeId: string,
  employeeName: string,
  startDate: string,
  endDate: string,
  reason: string,
  leaveType: string
): Promise<{ approvalCode: string; requestId: string }> {
  const approvalCode = generateUniqueApprovalCode('LV');

  const leaveData: InsertLeaveRequest = {
    employeeId,
    startDate,
    endDate,
    reason,
    leaveType: leaveType || 'casual',
    status: 'pending',
  };

  const leave = await storage.createLeaveRequest(leaveData);
  const superadminPhone = await getSuperadminPhone();

  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  await storage.createWhatsappPendingApproval({
    approvalCode,
    type: 'leave',
    requestId: leave.id,
    employeeId,
    employeeName,
    description: `${leaveType || 'Leave'} (${days} day${days > 1 ? 's' : ''}) - ${reason}`,
    status: 'pending',
    approverPhone: superadminPhone,
  });

  return { approvalCode, requestId: leave.id };
}

async function getEmployeeStatus(employeeId: string, employeeName: string): Promise<string> {
  const pendingExpenses = await storage.getExpenseReimbursementsByEmployee(employeeId);
  const pendingLeaves = await storage.getLeaveRequestsByEmployee(employeeId);
  
  const recentExpenses = pendingExpenses.slice(0, 3);
  const recentLeaves = pendingLeaves.slice(0, 3);
  
  let statusMessage = `📋 *Your Request Status*\n━━━━━━━━━━━━━━━━━━\n\n`;
  
  if (recentExpenses.length > 0) {
    statusMessage += `💰 *Recent Expenses:*\n`;
    recentExpenses.forEach((exp: any) => {
      const icon = exp.status === 'approved' ? '✅' : exp.status === 'rejected' ? '❌' : '⏳';
      statusMessage += `${icon} ₹${exp.amount} - ${exp.purpose} (${exp.status})\n`;
    });
    statusMessage += `\n`;
  }
  
  if (recentLeaves.length > 0) {
    statusMessage += `📅 *Recent Leave Requests:*\n`;
    recentLeaves.forEach((leave: any) => {
      const icon = leave.status === 'approved' ? '✅' : leave.status === 'rejected' ? '❌' : '⏳';
      statusMessage += `${icon} ${leave.startDate} - ${leave.reason} (${leave.status})\n`;
    });
  }
  
  if (recentExpenses.length === 0 && recentLeaves.length === 0) {
    statusMessage += `_No recent requests found._\n\nNeed to submit something? Just tell me! 🌳`;
  }
  
  return statusMessage;
}

async function notifySuperadmin(
  type: 'expense' | 'leave',
  approvalCode: string,
  employeeName: string,
  details: string,
  amount?: number,
  mediaUrl?: string
): Promise<void> {
  const superadminPhone = await getSuperadminPhone();
  if (!superadminPhone) return;

  let message = '';
  if (type === 'expense') {
    message = `🔔 *New Expense Request*\n━━━━━━━━━━━━━━━━━━\n\n👤 *From:* ${employeeName}\n📝 *Purpose:* ${details}\n💰 *Amount:* ₹${amount?.toLocaleString('en-IN')}\n📸 *Receipt:* ${mediaUrl ? 'Attached' : 'None'}\n🔖 *Code:* ${approvalCode}\n\n━━━━━━━━━━━━━━━━━━\n_Reply:_\n*A ${approvalCode}* - Approve\n*R ${approvalCode} reason* - Reject`;
  } else {
    message = `🔔 *New Leave Request*\n━━━━━━━━━━━━━━━━━━\n\n👤 *From:* ${employeeName}\n📅 *Details:* ${details}\n🔖 *Code:* ${approvalCode}\n\n━━━━━━━━━━━━━━━━━━\n_Reply:_\n*A ${approvalCode}* - Approve\n*R ${approvalCode} reason* - Reject`;
  }

  await sendWhatsAppMessage(superadminPhone, message);
}

export async function handleOaksyWhatsAppMessage(
  fromNumber: string,
  body: string,
  mediaUrl?: string,
  mediaContentType?: string,
  messageId?: string
): Promise<string> {
  const normalizedPhone = normalizePhoneNumber(fromNumber);
  
  await storage.createWhatsappInboundMessage({
    messageId: messageId || `msg_${Date.now()}`,
    fromNumber: normalizedPhone,
    toNumber: process.env.TWILIO_WHATSAPP_NUMBER || '',
    body,
    mediaUrl,
    mediaContentType,
    conversationId: null,
    processedAt: new Date(),
  });

  const conversation = await storage.getOrCreateWhatsappConversation(normalizedPhone);
  
  const employee = conversation.employeeId 
    ? await storage.getEmployee(conversation.employeeId)
    : null;

  if (!employee) {
    return `👋 Hi! I'm Oaksy, your AI companion at Oakstreet Events.\n\n❌ I couldn't find your employee record. Please contact HR to ensure your phone number is registered.\n\n_Once registered, I can help you submit expenses and apply for leave!_ 🌳`;
  }

  const messageText = body.trim();
  const lowerMessage = messageText.toLowerCase();
  
  let context: IntentContext = {};
  let history: ConversationMessage[] = [];
  
  try {
    const rawContext = conversation.intentContext;
    if (typeof rawContext === 'string') {
      context = JSON.parse(rawContext) || {};
    } else if (rawContext && typeof rawContext === 'object') {
      context = rawContext as IntentContext;
    }
  } catch {
    context = {};
  }
  
  try {
    const rawHistory = conversation.conversationHistory;
    if (typeof rawHistory === 'string') {
      history = JSON.parse(rawHistory) || [];
    } else if (Array.isArray(rawHistory)) {
      history = rawHistory as ConversationMessage[];
    }
  } catch {
    history = [];
  }
  
  history.push({
    role: 'user',
    content: messageText,
    timestamp: Date.now()
  });
  if (history.length > 10) {
    history = history.slice(-10);
  }

  if (lowerMessage.match(/^(a|approve)\s+([a-z]{2,3}\d+)/i) || 
      lowerMessage.match(/^(r|reject)\s+([a-z]{2,3}\d+)/i)) {
    const user = await storage.getUserByPhone(normalizedPhone);
    if (user?.role === 'superadmin') {
      return handleSuperadminApproval(messageText, normalizedPhone);
    }
  }

  if (lowerMessage === 'status' || lowerMessage === 'my status' || lowerMessage.includes('check status')) {
    return await getEmployeeStatus(employee.id, employee.name);
  }

  const directAmount = extractAmount(messageText);
  if (directAmount && !context.amount) {
    context.amount = directAmount;
    context.mediaUrl = mediaUrl;
    
    await storage.updateWhatsappConversation(conversation.id, {
      activeIntent: 'expense',
      intentContext: context,
      conversationHistory: history,
      currentState: 'awaiting_expense_purpose',
    });

    const response = `💰 Got it! ₹${directAmount.toLocaleString('en-IN')}${mediaUrl ? ' with receipt' : ''}.\n\nWhat was this expense for? 📝`;
    
    history.push({ role: 'assistant', content: response, timestamp: Date.now() });
    await storage.updateWhatsappConversation(conversation.id, { conversationHistory: history });
    
    return response;
  }

  if (mediaUrl && !context.amount) {
    context.mediaUrl = mediaUrl;
    
    await storage.updateWhatsappConversation(conversation.id, {
      activeIntent: 'expense',
      intentContext: context,
      conversationHistory: history,
      currentState: 'awaiting_expense_details',
    });

    const response = `📸 Got your receipt!\n\nPlease tell me:\n1️⃣ The amount\n2️⃣ What it was for\n\n_Example: "500 for taxi to venue"_`;
    
    history.push({ role: 'assistant', content: response, timestamp: Date.now() });
    await storage.updateWhatsappConversation(conversation.id, { conversationHistory: history });
    
    return response;
  }

  if (conversation.currentState === 'awaiting_expense_purpose' && context.amount) {
    context.purpose = messageText;
    
    await storage.updateWhatsappConversation(conversation.id, {
      intentContext: context,
      currentState: 'awaiting_expense_confirmation',
      conversationHistory: history,
    });

    const response = `✨ Great! Here's what I have:\n\n💰 Amount: ₹${context.amount.toLocaleString('en-IN')}\n📝 Purpose: ${context.purpose}\n📸 Receipt: ${context.mediaUrl ? 'Attached' : 'None'}\n\n*Should I send this for approval?*\n_Reply "yes" or "no"_`;
    
    history.push({ role: 'assistant', content: response, timestamp: Date.now() });
    await storage.updateWhatsappConversation(conversation.id, { conversationHistory: history });
    
    return response;
  }

  if (conversation.currentState === 'awaiting_expense_confirmation') {
    if (lowerMessage === 'yes' || lowerMessage === 'y' || lowerMessage === 'ok' || lowerMessage === 'confirm') {
      const { approvalCode } = await createExpenseRequest(
        employee.id,
        employee.name,
        context.purpose || 'Expense',
        context.amount || 0,
        context.mediaUrl
      );

      await notifySuperadmin('expense', approvalCode, employee.name, context.purpose || '', context.amount, context.mediaUrl);

      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: null,
        intentContext: null,
        currentState: 'idle',
        conversationHistory: [],
      });

      return `✅ *Expense Submitted!*\n━━━━━━━━━━━━━━━━━━\n\n💰 Amount: ₹${context.amount?.toLocaleString('en-IN')}\n📝 Purpose: ${context.purpose}\n🔖 Reference: ${approvalCode}\n\n_I've sent this for approval. Sit back and relax! 🌳_\n\n_You'll be notified once it's processed._`;
    } else if (lowerMessage === 'no' || lowerMessage === 'n' || lowerMessage === 'cancel') {
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: null,
        intentContext: null,
        currentState: 'idle',
        conversationHistory: [],
      });

      return `👍 No problem! I've cancelled that request.\n\nNeed anything else? Just let me know! 🌳`;
    }
  }

  if (lowerMessage.includes('sick') || lowerMessage.includes('leave') || 
      lowerMessage.includes('vacation') || lowerMessage.includes('off') ||
      lowerMessage.includes('holiday')) {
    
    let leaveType = 'casual';
    if (lowerMessage.includes('sick')) leaveType = 'sick';
    else if (lowerMessage.includes('vacation')) leaveType = 'vacation';
    
    context = { leaveType };
    
    await storage.updateWhatsappConversation(conversation.id, {
      activeIntent: 'leave',
      intentContext: context,
      currentState: 'awaiting_leave_dates',
      conversationHistory: history,
    });

    const response = `📅 *Applying for ${leaveType} leave*\n\nFor how many days do you need leave?\n\n_Tell me the dates, like:_\n"tomorrow" or "15/01 to 17/01"`;
    
    history.push({ role: 'assistant', content: response, timestamp: Date.now() });
    await storage.updateWhatsappConversation(conversation.id, { conversationHistory: history });
    
    return response;
  }

  if (conversation.currentState === 'awaiting_leave_dates') {
    const dates = messageText.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/g);
    
    if (dates && dates.length >= 1) {
      const today = new Date();
      const year = today.getFullYear();
      
      if (dates.length === 1) {
        context.startDate = dates[0];
        context.endDate = dates[0];
      } else {
        context.startDate = dates[0];
        context.endDate = dates[1];
      }
      
      await storage.updateWhatsappConversation(conversation.id, {
        intentContext: context,
        currentState: 'awaiting_leave_reason',
        conversationHistory: history,
      });

      const response = `📆 Got it! From ${context.startDate} to ${context.endDate}\n\nWhat's the reason for your leave? 📝`;
      
      history.push({ role: 'assistant', content: response, timestamp: Date.now() });
      await storage.updateWhatsappConversation(conversation.id, { conversationHistory: history });
      
      return response;
    }
    
    const daysMatch = messageText.match(/(\d+)\s*days?/i);
    if (daysMatch) {
      const days = parseInt(daysMatch[1]);
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + days - 1);
      
      context.startDate = startDate.toISOString().split('T')[0];
      context.endDate = endDate.toISOString().split('T')[0];
      
      await storage.updateWhatsappConversation(conversation.id, {
        intentContext: context,
        currentState: 'awaiting_leave_reason',
        conversationHistory: history,
      });

      const response = `📆 ${days} day${days > 1 ? 's' : ''} starting today.\n\nWhat's the reason for your leave? 📝`;
      
      history.push({ role: 'assistant', content: response, timestamp: Date.now() });
      await storage.updateWhatsappConversation(conversation.id, { conversationHistory: history });
      
      return response;
    }

    if (lowerMessage.includes('tomorrow')) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      context.startDate = tomorrow.toISOString().split('T')[0];
      context.endDate = context.startDate;
      
      await storage.updateWhatsappConversation(conversation.id, {
        intentContext: context,
        currentState: 'awaiting_leave_reason',
        conversationHistory: history,
      });

      return `📆 Leave for tomorrow noted.\n\nWhat's the reason? 📝`;
    }

    return `I couldn't understand the dates. Please tell me like:\n\n• "15/01 to 17/01"\n• "3 days"\n• "tomorrow"`;
  }

  if (conversation.currentState === 'awaiting_leave_reason') {
    context.reason = messageText;
    
    await storage.updateWhatsappConversation(conversation.id, {
      intentContext: context,
      currentState: 'awaiting_leave_confirmation',
      conversationHistory: history,
    });

    const response = `✨ Here's your leave request:\n\n📅 Type: ${context.leaveType || 'Casual'} Leave\n📆 From: ${context.startDate}\n📆 To: ${context.endDate}\n📝 Reason: ${context.reason}\n\n*Should I send this for approval?*\n_Reply "yes" or "no"_`;
    
    history.push({ role: 'assistant', content: response, timestamp: Date.now() });
    await storage.updateWhatsappConversation(conversation.id, { conversationHistory: history });
    
    return response;
  }

  if (conversation.currentState === 'awaiting_leave_confirmation') {
    if (lowerMessage === 'yes' || lowerMessage === 'y' || lowerMessage === 'ok' || lowerMessage === 'confirm') {
      const { approvalCode } = await createLeaveRequest(
        employee.id,
        employee.name,
        context.startDate || new Date().toISOString().split('T')[0],
        context.endDate || new Date().toISOString().split('T')[0],
        context.reason || 'Personal',
        context.leaveType || 'casual'
      );

      await notifySuperadmin('leave', approvalCode, employee.name, 
        `${context.leaveType || 'Leave'} from ${context.startDate} to ${context.endDate} - ${context.reason}`);

      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: null,
        intentContext: null,
        currentState: 'idle',
        conversationHistory: [],
      });

      return `✅ *Leave Request Submitted!*\n━━━━━━━━━━━━━━━━━━\n\n📅 Type: ${context.leaveType || 'Casual'} Leave\n📆 Dates: ${context.startDate} to ${context.endDate}\n📝 Reason: ${context.reason}\n🔖 Reference: ${approvalCode}\n\n_I've sent this for approval. Sit back and relax! 🌳_`;
    } else if (lowerMessage === 'no' || lowerMessage === 'n' || lowerMessage === 'cancel') {
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: null,
        intentContext: null,
        currentState: 'idle',
        conversationHistory: [],
      });

      return `👍 No problem! I've cancelled that request.\n\nNeed anything else? Just let me know! 🌳`;
    }
  }

  if (conversation.currentState === 'awaiting_expense_details' && context.mediaUrl) {
    const amount = extractAmount(messageText);
    const purposeMatch = messageText.replace(/(?:Rs\.?|₹|INR)?\s*[0-9,]+(?:\.[0-9]+)?\s*(?:\/-)?/gi, '').trim();
    
    if (amount) {
      context.amount = amount;
      context.purpose = purposeMatch || undefined;
      
      if (context.purpose) {
        await storage.updateWhatsappConversation(conversation.id, {
          intentContext: context,
          currentState: 'awaiting_expense_confirmation',
          conversationHistory: history,
        });

        return `✨ Great! Here's what I have:\n\n💰 Amount: ₹${context.amount.toLocaleString('en-IN')}\n📝 Purpose: ${context.purpose}\n📸 Receipt: Attached\n\n*Should I send this for approval?*\n_Reply "yes" or "no"_`;
      } else {
        await storage.updateWhatsappConversation(conversation.id, {
          intentContext: context,
          currentState: 'awaiting_expense_purpose',
          conversationHistory: history,
        });

        return `💰 Got ₹${amount.toLocaleString('en-IN')}!\n\nWhat was this expense for? 📝`;
      }
    }
    
    return `Please tell me the amount and purpose.\n\n_Example: "500 for taxi to venue"_`;
  }

  if (lowerMessage === 'hi' || lowerMessage === 'hello' || lowerMessage === 'hey' || lowerMessage === 'menu') {
    await storage.updateWhatsappConversation(conversation.id, {
      activeIntent: null,
      intentContext: null,
      currentState: 'idle',
      conversationHistory: [],
    });

    return `👋 Hi ${employee.name}! I'm *Oaksy AI*, your HR companion at Oakstreet Events 🌳\n\n*Here's what I can help with:*\n\n💰 *Submit Expenses* - Just send the amount or a receipt photo\n📅 *Apply for Leave* - Say "sick leave" or "vacation"\n📋 *Check Status* - Type "status" to see your requests\n\n_Just tell me what you need!_`;
  }

  return `👋 Hi ${employee.name}! I'm Oaksy, your HR companion 🌳\n\n*Quick tips:*\n• Send an amount like "500" to submit expenses\n• Say "sick leave" or "vacation" to apply for leave\n• Type "status" to check your requests\n\n_How can I help you today?_`;
}

async function handleSuperadminApproval(message: string, fromPhone: string): Promise<string> {
  const approveMatch = message.match(/^(a|approve)\s+([a-z]{2,3}\d+)/i);
  const rejectMatch = message.match(/^(r|reject)\s+([a-z]{2,3}\d+)\s*(.*)?/i);

  if (approveMatch) {
    const code = approveMatch[2].toUpperCase();
    const approval = await storage.getWhatsappPendingApprovalByCode(code);
    
    if (!approval) {
      return `❌ Request ${code} not found.`;
    }
    
    if (approval.status !== 'pending') {
      return `⚠️ Request ${code} was already ${approval.status}.`;
    }

    await storage.updateWhatsappPendingApproval(approval.id, {
      status: 'approved',
      respondedAt: new Date(),
    });

    if (approval.type === 'expense') {
      await storage.updateExpenseReimbursement(approval.requestId, { status: 'approved' });
    } else {
      await storage.updateLeaveRequest(approval.requestId, { status: 'approved' });
    }

    const employee = await storage.getEmployee(approval.employeeId);
    if (employee?.phone) {
      const amount = approval.amount ? `₹${parseFloat(approval.amount).toLocaleString('en-IN')}` : '';
      const notifyMessage = approval.type === 'expense'
        ? `🎉 *Great news!*\n\nYour expense request for ${amount} has been *approved*! ✅\n\nYou'll receive your reimbursement shortly. 💰`
        : `🎉 *Great news!*\n\nYour leave request has been *approved*! ✅\n\nEnjoy your time off! 🌴`;
      
      await sendWhatsAppMessage(employee.phone, notifyMessage);
    }

    return `✅ *Approved* - ${code}\n\n_Employee has been notified._`;
  }

  if (rejectMatch) {
    const code = rejectMatch[2].toUpperCase();
    const reason = rejectMatch[3]?.trim() || 'No reason provided';
    
    const approval = await storage.getWhatsappPendingApprovalByCode(code);
    
    if (!approval) {
      return `❌ Request ${code} not found.`;
    }
    
    if (approval.status !== 'pending') {
      return `⚠️ Request ${code} was already ${approval.status}.`;
    }

    await storage.updateWhatsappPendingApproval(approval.id, {
      status: 'rejected',
      responseMessage: reason,
      respondedAt: new Date(),
    });

    if (approval.type === 'expense') {
      await storage.updateExpenseReimbursement(approval.requestId, { status: 'rejected' });
    } else {
      await storage.updateLeaveRequest(approval.requestId, { status: 'rejected' });
    }

    const employee = await storage.getEmployee(approval.employeeId);
    if (employee?.phone) {
      const notifyMessage = approval.type === 'expense'
        ? `ℹ️ *Update on your expense request*\n\nUnfortunately, your request was not approved.\n\n*Reason:* ${reason}\n\n_If you have questions, please reach out to HR._`
        : `ℹ️ *Update on your leave request*\n\nUnfortunately, your request was not approved.\n\n*Reason:* ${reason}\n\n_If you have questions, please reach out to HR._`;
      
      await sendWhatsAppMessage(employee.phone, notifyMessage);
    }

    return `❌ *Rejected* - ${code}\n*Reason:* ${reason}\n\n_Employee has been notified._`;
  }

  return `❓ Invalid command. Use:\n\n*A CODE* - Approve\n*R CODE reason* - Reject`;
}
