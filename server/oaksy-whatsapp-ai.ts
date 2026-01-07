import OpenAI from "openai";
import { storage } from './storage';
import { sendWhatsAppMessage, isWhatsAppConfigured } from './whatsapp-service';
import type { WhatsappConversation, InsertExpenseReimbursement, InsertLeaveRequest } from '@shared/schema';
import { objectStorageClient } from './objectStorage';
import { randomUUID } from 'crypto';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Helper to convert Twilio media URL to our proxy URL for public access
function getPublicMediaUrl(twilioMediaUrl: string): string {
  if (!twilioMediaUrl || !twilioMediaUrl.includes('twilio.com')) {
    return twilioMediaUrl; // Return as-is if not a Twilio URL
  }
  
  try {
    // Parse the Twilio URL to extract message ID and media ID
    // URL format: https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages/{MessageId}/Media/{MediaId}
    const match = twilioMediaUrl.match(/Messages\/([^/]+)\/Media\/([^/?]+)/);
    if (!match) {
      console.log('[Media] Could not parse Twilio URL:', twilioMediaUrl);
      return twilioMediaUrl;
    }
    
    const [, messageId, mediaId] = match;
    
    // Get the base URL from environment - use REPLIT_DEV_DOMAIN for development
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : 'http://localhost:5000';
    
    const proxyUrl = `${baseUrl}/api/media-proxy/${messageId}/${mediaId}`;
    console.log('[Media] Created proxy URL:', proxyUrl);
    return proxyUrl;
  } catch (error: any) {
    console.error('[Media] Error creating proxy URL:', error.message);
    return twilioMediaUrl; // Fallback to original URL
  }
}

interface IntentContext {
  amount?: number;
  purpose?: string;
  mediaUrl?: string;
  startDate?: string;
  endDate?: string;
  leaveType?: string;
  reason?: string;
  confirmed?: boolean;
  // Vendor payment fields
  vendorName?: string;
  eventName?: string;
  vendorPaymentVendor?: string;
  vendorPaymentEvent?: string;
  // Vendor payment correction fields
  lastVendorPaymentCode?: string;
  lastVendorPaymentAmount?: number;
  // QR Payment specific fields
  qrPaymentCategory?: string;
  qrPaymentDescription?: string;
  qrImageUrl?: string;
  // Image clarification fields
  pendingMediaUrl?: string;
  pendingAmount?: number;
  pendingPurpose?: string;
  // Income submission fields
  incomeScreenshotUrl?: string;
  incomeClientName?: string;
  incomeType?: string;
  // Delivery challan fields
  deliverTo?: string;
  deliveryAddress?: string;
  itemDescription?: string;
  vehicleNumber?: string;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const OAKSY_SYSTEM_PROMPT = `You are Oaksy AI, the intelligent companion for Oakstreet Events. You are a versatile assistant who adapts to each user's role and needs.

YOUR ROLES (based on who you're talking to):
- For EMPLOYEES: HR assistant, expense helper, leave manager
- For WEDDING PLANNERS (Fida, Femina): Event coordinator, vendor liaison, production assistant
- For ACCOUNTANTS: Financial assistant, daybook helper, payment tracker
- For SUPERADMIN (Kishor): Full business assistant with complete access to all data

PERSONALITY:
- Warm, friendly, and professional like a trusted colleague
- Use simple, conversational language with occasional emojis
- Be flexible - understand what they mean, not just what they say
- Be proactive - anticipate needs and suggest helpful actions
- Keep responses concise for WhatsApp

CAPABILITIES:
1. EXPENSES & PAYMENTS: Help submit expenses, track vendor payments, record income
2. LEAVE MANAGEMENT: Process leave requests, check balances, track approvals
3. EVENT COORDINATION: Help with event details, production schedules, team assignments
4. FINANCIAL QUERIES: Daybook entries, payment status, vendor management
5. STATUS CHECKS: Any pending requests, approvals, or action items
6. DELIVERY CHALLANS: Create delivery challans for goods/materials (wedding planners and accountants only)

FLEXIBILITY GUIDELINES:
- Understand natural language - don't require specific formats
- If someone says "need to pay vendor" or "pending payment" or "vendor owes money" - understand it's about vendor payments
- Parse amounts flexibly: "5000", "5k", "5 thousand", "Rs 5000", "₹5000" all mean 5000
- Accept dates in any format: "tomorrow", "next Monday", "15th Jan", "15/1"
- If unclear, ask a simple clarifying question

SECURITY RULES (CRITICAL):
- NEVER share salary details, profit margins, or financial summaries with non-superadmins
- Employees can only see their own requests and data
- Wedding planners can see event-related data for their assigned events
- Only superadmin can see company-wide financial data

RESPONSE FORMAT - Always respond with valid JSON:
{
  "intent": "expense" | "leave" | "status" | "vendor_payment" | "income" | "delivery_challan" | "event_query" | "greeting" | "confirmation" | "general",
  "extractedData": {
    "amount": number or null,
    "purpose": string or null,
    "vendorName": string or null,
    "eventName": string or null,
    "leaveType": "sick" | "casual" | "vacation" | "personal" | null,
    "startDate": "DD/MM/YYYY" or null,
    "endDate": "DD/MM/YYYY" or null,
    "reason": string or null,
    "deliverTo": string or null,
    "deliveryAddress": string or null,
    "itemDescription": string or null,
    "vehicleNumber": string or null
  },
  "needsMoreInfo": ["purpose", "amount", "dates", "reason", "vendorName", "confirmation"] or [],
  "isComplete": boolean,
  "message": "Your friendly, helpful response"
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

function numberToWords(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  if (num === 0) return 'Zero';
  if (num < 20) return ones[num];
  if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
  if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + numberToWords(num % 100) : '');
  if (num < 100000) return numberToWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + numberToWords(num % 1000) : '');
  if (num < 10000000) return numberToWords(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + numberToWords(num % 100000) : '');
  return numberToWords(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 ? ' ' + numberToWords(num % 10000000) : '');
}

function extractAmount(text: string): number | null {
  // Handle shorthand notations first: "5k" = 5000, "1 lakh" = 100000, "5 thousand" = 5000
  // Use flexible regex to handle various spellings: lakh, lakhs, lakkh, lakkhs, lac, lacs
  const shorthandPatterns = [
    { pattern: /([0-9,]+(?:\.[0-9]+)?)\s*(?:la+k+h?s?|lacs?)/i, multiplier: 100000 },
    { pattern: /([0-9,]+(?:\.[0-9]+)?)\s*(?:k|thousand|thousands)/i, multiplier: 1000 },
    { pattern: /([0-9,]+(?:\.[0-9]+)?)\s*(?:cr|crore|crores)/i, multiplier: 10000000 },
  ];
  
  // Check shorthand patterns FIRST before any generic number extraction
  for (const { pattern, multiplier } of shorthandPatterns) {
    const match = text.match(pattern);
    if (match) {
      const baseAmount = parseFloat(match[1].replace(/,/g, ''));
      const amount = baseAmount * multiplier;
      if (amount > 0 && amount < 100000000) {
        return amount;
      }
    }
  }
  
  // Standard patterns with currency symbols
  const currencyPatterns = [
    /(?:Rs\.?|₹|INR)\s*([0-9,]+(?:\.[0-9]+)?)/i,
    /([0-9,]+(?:\.[0-9]+)?)\s*(?:Rs\.?|₹|INR|rupees?)/i,
    /([0-9,]+(?:\.[0-9]+)?)\s*\/-/,
  ];
  
  for (const pattern of currencyPatterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (amount > 0 && amount < 100000000) {
        return amount;
      }
    }
  }
  
  // Last resort: plain numbers (but only if they look like amounts - at least 2 digits or has decimal)
  const plainNumberMatch = text.match(/\b([0-9]{2,}(?:,[0-9]+)*(?:\.[0-9]+)?)\b/);
  if (plainNumberMatch) {
    const amount = parseFloat(plainNumberMatch[1].replace(/,/g, ''));
    if (amount > 0 && amount < 100000000) {
      return amount;
    }
  }
  
  return null;
}

// Detect if message is an income/payment received submission (not expense/QR payment)
function detectIncomeSubmission(text: string): { isIncome: boolean; clientName?: string; bankName?: string; type: 'client_payment' | 'bank_transfer' } {
  const lowerText = text.toLowerCase();
  
  // Expense phrases that indicate outgoing payment request (NOT income) - check first
  const expensePhrases = [
    /\bplease\s+pay\b/i,
    /\bneed\s+(?:to\s+)?pay\b/i,
    /\bfor\s+payment\b/i,
    /\bpay\s+(?:for|to|this)\b/i,
    /\bpending\s+payment\b/i,
    /\bqr\s*(?:code)?\b/i,  // QR code mentions are NOT income
    /\bvendor\s+payment\b/i, // Vendor payments are NOT income
  ];
  
  // Check for expense/QR phrases first - these indicate NOT income
  for (const phrase of expensePhrases) {
    if (phrase.test(lowerText)) {
      return { isIncome: false, type: 'client_payment' };
    }
  }
  
  // Extract bank name from message - patterns like "bank Kishor", "to Kishor bank", "Kishor account"
  let bankName: string | undefined;
  const bankPatterns = [
    /bank\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i,  // "bank Kishor" or "bank HDFC"
    /(?:to|in)\s+([a-zA-Z]+)\s+(?:bank|account)/i,  // "to Kishor bank" or "in Kishor account"
    /([a-zA-Z]+)\s+(?:bank|account)\b/i,  // "Kishor bank" or "HDFC account"
  ];
  
  for (const pattern of bankPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      // Don't capture income-related keywords as bank names
      const captured = match[1].trim().toLowerCase();
      if (!['income', 'transfer', 'payment', 'received', 'from', 'to', 'the'].includes(captured)) {
        bankName = match[1].trim();
        break;
      }
    }
  }
  
  // Income patterns with client name extraction
  const incomePatterns = [
    /income\s+from\s+(.+)/i,
    /received\s+from\s+(.+)/i,
    /payment\s+received\s*(?:from\s+)?(.+)?/i,
    /client\s+payment\s*(?:from\s+)?(.+)?/i,
    /customer\s+payment\s*(?:from\s+)?(.+)?/i,
    /credited\s+(?:by|from)\s+(.+)/i,
    /bank\s+(?:to\s+bank|transfer)\s*(?:from\s+)?(.+)?/i,
    /transfer\s+received\s*(?:from\s+)?(.+)?/i,
    /advance\s+(?:from|received)\s*(.+)?/i,
    /amount\s+received\s*(?:from\s+)?(.+)?/i,
    /payment\s+from\s+(.+)/i,
    /received\s+payment\s*(?:from\s+)?(.+)?/i,
    /got\s+payment\s*(?:from\s+)?(.+)?/i,
  ];
  
  // Check for income patterns with client name
  for (const pattern of incomePatterns) {
    const match = text.match(pattern);
    if (match) {
      let clientName = match[1]?.trim() || undefined;
      if (clientName) {
        // Remove amount and bank references from client name
        clientName = clientName.replace(/₹?\s*\d+[,\d]*\.?\d*/g, '').replace(/rs\.?\s*/gi, '').replace(/\bbank\s+\w+/gi, '').trim() || clientName;
      }
      const isBankTransfer = /bank\s+(?:to\s+bank|transfer)/i.test(text);
      return { 
        isIncome: true, 
        clientName: clientName || 'Client',
        bankName,
        type: isBankTransfer ? 'bank_transfer' : 'client_payment'
      };
    }
  }
  
  // Simple keyword triggers - "income" keyword is primary indicator
  const simpleIncomeKeywords = [
    /\bcustomer\s+payment\b/i,
    /\bclient\s+payment\b/i,
    /\bincome\s+screenshot\b/i,
    /\bpayment\s+screenshot\b/i,
    /\breceived\s+amount\b/i,
    /\bamount\s+credited\b/i,
    /\bmoney\s+received\b/i,
    /\bfunds\s+received\b/i,
    /\bincome\b/i,  // Simple "income" keyword - highest priority
  ];
  
  for (const keyword of simpleIncomeKeywords) {
    if (keyword.test(lowerText)) {
      return { 
        isIncome: true, 
        clientName: 'Client',
        bankName,
        type: 'client_payment'
      };
    }
  }
  
  return { isIncome: false, type: 'client_payment' };
}

// Detect if message is a vendor payment submission
// Simplified: triggers on "vendor payment", "vendor payments", or "vendor pending payment"
// Format: vendor name, amount (optional event)
// Example: "vendor payments\nFlower shop 5000" or "vendor payment flower shop 5000 sharma wedding"
function detectPendingVendorPayment(text: string): { isPending: boolean; vendorName?: string; amount?: number; eventName?: string } {
  const lowerText = text.toLowerCase().trim();
  
  // Trigger on variations: "vendor payment(s)", "pending vendor payment", "vendor pending payment"
  const triggerPatterns = [
    /vendor\s+payment[s]?/i,
    /pending\s+vendor\s+payment[s]?/i,
    /vendor\s+pending\s+payment[s]?/i,
  ];
  
  const hasTrigger = triggerPatterns.some(p => p.test(lowerText));
  if (!hasTrigger) {
    return { isPending: false };
  }
  
  // Remove the trigger phrase to parse the rest
  let remainingText = text
    .replace(/vendor\s+pending\s+payment[s]?/gi, '')
    .replace(/pending\s+vendor\s+payment[s]?/gi, '')
    .replace(/vendor\s+payment[s]?/gi, '')
    .trim();
  
  // If nothing after trigger, just starting the flow
  if (!remainingText) {
    return { isPending: true };
  }
  
  // Parse simple format: "vendor name amount [event]"
  // Examples:
  // "Flower shop 5000"
  // "Flower shop 5000 sharma wedding"
  // "Ajish Flowers 25000 Megha Wedding"
  
  // Extract amount (any number, no Rs prefix needed)
  const amount = extractAmount(remainingText);
  
  // Extract vendor name (text before the amount)
  let vendorName: string | undefined;
  let eventName: string | undefined;
  
  if (amount) {
    // Find the amount in text and split around it
    const amountMatch = remainingText.match(/(\d{1,3}(?:[,\d]*)?(?:\.\d+)?)/);
    if (amountMatch) {
      const amountIndex = remainingText.indexOf(amountMatch[0]);
      const beforeAmount = remainingText.substring(0, amountIndex).trim();
      const afterAmount = remainingText.substring(amountIndex + amountMatch[0].length).trim();
      
      // Clean up vendor name (remove Rs, ₹, etc.)
      vendorName = beforeAmount
        .replace(/[\-:,]+$/g, '')
        .replace(/^[\-:,]+/g, '')
        .replace(/\brs\.?\s*$/gi, '')
        .replace(/₹\s*$/g, '')
        .trim();
      
      // Event name is anything after the amount
      if (afterAmount && afterAmount.length > 1) {
        eventName = afterAmount
          .replace(/^[\-:,\s]+/g, '')
          .replace(/\bfor\s+/gi, '')
          .replace(/\bevent[\s:]+/gi, '')
          .trim();
      }
    }
  } else {
    // No amount found - treat entire text as vendor name
    vendorName = remainingText.replace(/^[\-:,\s]+/g, '').trim();
  }
  
  // Clean up vendor name
  if (vendorName && vendorName.length < 2) {
    vendorName = undefined;
  }
  
  return { 
    isPending: true, 
    vendorName: vendorName || undefined,
    amount: amount || undefined,
    eventName: eventName || undefined
  };
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
  hasMedia: boolean,
  userRole?: string,
  userName?: string
): Promise<{
  intent: string;
  extractedData: Partial<IntentContext>;
  needsMoreInfo: string[];
  isComplete: boolean;
  message: string;
}> {
  const recentHistory = conversationHistory.slice(-6);
  
  const historyText = recentHistory.map(m => 
    `${m.role === 'user' ? 'User' : 'Oaksy'}: ${m.content}`
  ).join('\n');

  const currentContext = context ? JSON.stringify(context) : '{}';
  
  // Determine role context
  let roleContext = 'Employee';
  if (userRole === 'superadmin') {
    roleContext = 'Superadmin (full access to all data)';
  } else if (userRole === 'wedding_planner' || userName?.toLowerCase().includes('fida') || userName?.toLowerCase().includes('femina')) {
    roleContext = 'Wedding Planner (can manage events, vendors, production)';
  } else if (userRole === 'accountant') {
    roleContext = 'Accountant (can manage finances, daybook)';
  } else if (userRole === 'manager' || userRole === 'admin') {
    roleContext = 'Manager (can view team data)';
  }
  
  const userPrompt = `Current conversation context: ${currentContext}
User: ${userName || 'Unknown'} (Role: ${roleContext})
Has image attached: ${hasMedia ? 'Yes' : 'No'}

Recent conversation:
${historyText}

New message: "${message}"

Understand the intent flexibly - don't require specific formats. Be helpful and conversational.`;

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
      message: content || "Hi! I'm Oaksy, your companion at Oakstreet Events. How can I help you today? 🌳"
    };
  } catch (error: any) {
    console.error('[Oaksy AI] Error:', error.message);
    return {
      intent: 'general',
      extractedData: {},
      needsMoreInfo: [],
      isComplete: false,
      message: "Hi! I'm Oaksy, your companion at Oakstreet Events. How can I help you? 🌳"
    };
  }
}

// Superadmin WhatsApp number for approval notifications
const SUPERADMIN_WHATSAPP = '+917902373354';

// Wedding Planner phone numbers for lead notifications
const WEDDING_PLANNER_PHONES: Record<string, string> = {
  'fida fathima': '+919895810975',
  'fida': '+919895810975',
  'femina km': '+917306687284',
  'femina': '+917306687284',
};

async function getSuperadminPhone(): Promise<string> {
  return SUPERADMIN_WHATSAPP;
}

function getWeddingPlannerPhone(plannerName: string): string | null {
  const normalized = plannerName.toLowerCase().trim();
  for (const [key, phone] of Object.entries(WEDDING_PLANNER_PHONES)) {
    if (normalized.includes(key)) {
      return phone;
    }
  }
  return null;
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
  const today = new Date().toISOString().split('T')[0];

  const expenseData: InsertExpenseReimbursement = {
    employeeId,
    requestDate: today,
    expenseDate: today,
    category: 'other',
    description: purpose,
    amount: amount.toString(),
    status: 'pending',
    voucherPath: mediaUrl || null,
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

// Superadmin Lead System Prompt
const SUPERADMIN_LEAD_PROMPT = `You are Oaksy AI, helping the Superadmin of Oakstreet Events add leads to Oak Sales via WhatsApp.

When the superadmin sends a message about a potential client/lead, extract:
1. Customer Name (required)
2. Customer Phone (if available) 
3. Event Date (if available)
4. Venue (if available)
5. Assigned Wedding Planner - must be either "Fida Fathima" or "Femina KM"

PERSONALITY:
- Professional and efficient
- Quick to extract and confirm information
- Use simple confirmations

RESPONSE FORMAT - Always respond with valid JSON:
{
  "isLead": true/false,
  "extractedData": {
    "customerName": string or null,
    "customerPhone": string or null,
    "eventDate": "YYYY-MM-DD" or null,
    "venue": string or null,
    "weddingPlanner": "Fida Fathima" | "Femina KM" | null
  },
  "needsMoreInfo": ["customerName", "weddingPlanner"] or [],
  "isComplete": boolean,
  "message": "Your response to the superadmin"
}

If the message doesn't look like a lead (e.g., approval commands), set isLead: false.`;

interface LeadContext {
  customerName?: string;
  customerPhone?: string;
  eventDate?: string;
  venue?: string;
  weddingPlanner?: string;
  confirmed?: boolean;
}

async function analyzeLeadWithAI(
  message: string,
  context: LeadContext,
  conversationHistory: ConversationMessage[]
): Promise<{
  isLead: boolean;
  extractedData: Partial<LeadContext>;
  needsMoreInfo: string[];
  isComplete: boolean;
  message: string;
}> {
  const recentHistory = conversationHistory.slice(-6);
  
  const historyText = recentHistory.map(m => 
    `${m.role === 'user' ? 'Superadmin' : 'Oaksy'}: ${m.content}`
  ).join('\n');
  
  const userPrompt = `Current context: ${JSON.stringify(context)}
Recent conversation:
${historyText}

Superadmin's message: "${message}"

Extract lead information and respond.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SUPERADMIN_LEAD_PROMPT },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.5,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || '';
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return {
      isLead: false,
      extractedData: {},
      needsMoreInfo: [],
      isComplete: false,
      message: content || "I can help you add leads. Send me customer details!"
    };
  } catch (error: any) {
    console.error('[Oaksy AI Lead] Error:', error.message);
    return {
      isLead: false,
      extractedData: {},
      needsMoreInfo: [],
      isComplete: false,
      message: "Sorry, I had trouble processing that. Please try again."
    };
  }
}

async function createLeadInOakSales(
  leadContext: LeadContext,
  createdBy: string
): Promise<{ dealId: string; contactId: string }> {
  // Find the wedding planner user ID first
  let ownerId: string | null = null;
  let plannerUser: any = null;
  
  if (leadContext.weddingPlanner) {
    const users = await storage.getAllUsers();
    plannerUser = users.find(u => 
      u.name.toLowerCase().includes(leadContext.weddingPlanner!.toLowerCase().split(' ')[0])
    );
    if (plannerUser) {
      ownerId = plannerUser.id;
    }
  }
  
  // Get or create a pipeline for the wedding planner
  const pipelines = await storage.getAllSalesPipelines();
  const plannerName = leadContext.weddingPlanner || 'General';
  
  // Look for existing pipeline matching the planner's name
  let pipeline = pipelines.find(p => 
    p.name.toLowerCase().includes(plannerName.toLowerCase().split(' ')[0])
  );
  
  if (!pipeline) {
    // Create a new pipeline for this wedding planner
    pipeline = await storage.createSalesPipeline({
      name: plannerName,
      description: `Pipeline for ${plannerName}`,
      isDefault: false,
    });
    console.log(`[Oaksy] Created new pipeline for ${plannerName}: ${pipeline.id}`);
  }
  
  const stages = await storage.getSalesStagesByPipelineId(pipeline.id);
  let firstStage = stages.sort((a, b) => a.order - b.order)[0];
  
  if (!firstStage) {
    // Create default stages for the pipeline
    firstStage = await storage.createSalesStage({
      pipelineId: pipeline.id,
      name: 'Lead',
      order: 1,
      color: '#6B7280',
      probability: 10,
    });
    
    // Add more stages
    await storage.createSalesStage({
      pipelineId: pipeline.id,
      name: 'Contacted',
      order: 2,
      color: '#3B82F6',
      probability: 30,
    });
    
    await storage.createSalesStage({
      pipelineId: pipeline.id,
      name: 'Meeting Scheduled',
      order: 3,
      color: '#F59E0B',
      probability: 50,
    });
    
    await storage.createSalesStage({
      pipelineId: pipeline.id,
      name: 'Proposal Sent',
      order: 4,
      color: '#8B5CF6',
      probability: 70,
    });
    
    await storage.createSalesStage({
      pipelineId: pipeline.id,
      name: 'Won',
      order: 5,
      color: '#10B981',
      probability: 100,
    });
    
    await storage.createSalesStage({
      pipelineId: pipeline.id,
      name: 'Lost',
      order: 6,
      color: '#EF4444',
      probability: 0,
    });
  }
  
  // Create the contact
  const nameParts = (leadContext.customerName || 'Unknown').split(' ');
  const contact = await storage.createSalesContact({
    firstName: nameParts[0],
    lastName: nameParts.slice(1).join(' ') || null,
    phone: leadContext.customerPhone || null,
    source: 'WhatsApp',
    ownerId,
  });
  
  // Create the deal
  const deal = await storage.createSalesDeal({
    title: `${leadContext.customerName || 'New Lead'} - ${leadContext.venue || 'TBD'}`,
    pipelineId: pipeline.id,
    stageId: firstStage.id,
    contactId: contact.id,
    ownerId,
    eventDate: leadContext.eventDate || null,
    venue: leadContext.venue || null,
    source: 'WhatsApp',
    status: 'open',
    eventType: 'wedding',
  });
  
  return { dealId: deal.id, contactId: contact.id };
}

async function notifyWeddingPlanner(
  plannerName: string,
  leadDetails: LeadContext
): Promise<boolean> {
  const plannerPhone = getWeddingPlannerPhone(plannerName);
  if (!plannerPhone) {
    console.log('[Oaksy] No phone number found for planner:', plannerName);
    return false;
  }
  
  const message = `🌳 *New Lead Assigned*\n━━━━━━━━━━━━━━━━━━\n\n👤 *Customer:* ${leadDetails.customerName || 'Not specified'}\n📞 *Phone:* ${leadDetails.customerPhone || 'Not provided'}\n📅 *Event Date:* ${leadDetails.eventDate || 'TBD'}\n📍 *Venue:* ${leadDetails.venue || 'TBD'}\n\n_Added via WhatsApp by Superadmin_\n\nCheck Oak Sales for more details 🌿`;
  
  try {
    await sendWhatsAppMessage(plannerPhone, message);
    return true;
  } catch (error) {
    console.error('[Oaksy] Failed to notify planner:', error);
    return false;
  }
}

async function handleSuperadminLeadMessage(
  messageText: string,
  fromNumber: string
): Promise<string | null> {
  // Get or create conversation for superadmin
  const conversation = await storage.getOrCreateWhatsappConversation(fromNumber);
  
  let leadContext: LeadContext = {};
  let history: ConversationMessage[] = [];
  
  try {
    const rawContext = conversation.intentContext;
    if (typeof rawContext === 'string') {
      leadContext = JSON.parse(rawContext) || {};
    } else if (rawContext && typeof rawContext === 'object') {
      leadContext = rawContext as LeadContext;
    }
  } catch {
    leadContext = {};
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
  
  history.push({ role: 'user', content: messageText, timestamp: Date.now() });
  if (history.length > 10) history = history.slice(-10);
  
  // Analyze the message for lead content
  const analysis = await analyzeLeadWithAI(messageText, leadContext, history);
  
  // If it's not a lead message, return null to let other handlers process it
  if (!analysis.isLead) {
    return null;
  }
  
  // Merge extracted data into context
  leadContext = { ...leadContext, ...analysis.extractedData };
  
  // Check if user is confirming
  const lowerMessage = messageText.toLowerCase();
  if ((lowerMessage === 'yes' || lowerMessage === 'confirm' || lowerMessage === 'ok') && 
      leadContext.customerName && leadContext.weddingPlanner) {
    leadContext.confirmed = true;
  }
  
  // If complete and confirmed, create the lead
  if (analysis.isComplete && leadContext.confirmed && leadContext.customerName && leadContext.weddingPlanner) {
    try {
      const { dealId } = await createLeadInOakSales(leadContext, 'superadmin');
      
      // Notify the wedding planner
      await notifyWeddingPlanner(leadContext.weddingPlanner, leadContext);
      
      // Reset context
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: null,
        intentContext: {},
        conversationHistory: [],
        currentState: 'idle',
      });
      
      const response = `✅ *Lead Added Successfully!*\n\n👤 ${leadContext.customerName}\n📍 ${leadContext.venue || 'TBD'}\n📅 ${leadContext.eventDate || 'TBD'}\n👰 Assigned to: ${leadContext.weddingPlanner}\n\n_${leadContext.weddingPlanner} has been notified via WhatsApp!_ 🌳`;
      
      return response;
    } catch (error: any) {
      console.error('[Oaksy] Error creating lead:', error.message);
      return `❌ Sorry, I couldn't create this lead. Error: ${error.message}\n\nPlease try again or add it directly in Oak Sales.`;
    }
  }
  
  // If we have enough info but not confirmed, ask for confirmation
  if (leadContext.customerName && leadContext.weddingPlanner && !leadContext.confirmed) {
    await storage.updateWhatsappConversation(conversation.id, {
      activeIntent: 'lead',
      intentContext: leadContext,
      conversationHistory: history,
      currentState: 'awaiting_lead_confirmation',
    });
    
    const response = `📝 *Confirm Lead Details:*\n━━━━━━━━━━━━━━━━━━\n\n👤 *Customer:* ${leadContext.customerName}\n📞 *Phone:* ${leadContext.customerPhone || 'Not provided'}\n📅 *Event Date:* ${leadContext.eventDate || 'TBD'}\n📍 *Venue:* ${leadContext.venue || 'TBD'}\n👰 *Wedding Planner:* ${leadContext.weddingPlanner}\n\n_Reply "Yes" to add this lead_ 🌳`;
    
    history.push({ role: 'assistant', content: response, timestamp: Date.now() });
    await storage.updateWhatsappConversation(conversation.id, { conversationHistory: history });
    
    return response;
  }
  
  // Need more information
  await storage.updateWhatsappConversation(conversation.id, {
    activeIntent: 'lead',
    intentContext: leadContext,
    conversationHistory: history,
    currentState: 'collecting_lead_info',
  });
  
  history.push({ role: 'assistant', content: analysis.message, timestamp: Date.now() });
  await storage.updateWhatsappConversation(conversation.id, { conversationHistory: history });
  
  return analysis.message;
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
  
  const messageText = body.trim();
  const lowerMessage = messageText.toLowerCase();
  
  // Check if this is from the superadmin FIRST (before employee check)
  const isSuperadminByPhone = normalizedPhone === SUPERADMIN_WHATSAPP || 
                              normalizedPhone.endsWith(SUPERADMIN_WHATSAPP.slice(-10)) ||
                              SUPERADMIN_WHATSAPP.endsWith(normalizedPhone.slice(-10));
  
  // Handle superadmin (Kishor) messages directly
  if (isSuperadminByPhone) {
    // Handle approval commands (A/R for expenses/leave)
    if (lowerMessage.match(/^(a|approve)\s+([a-z]{2,3}\d+)/i) || 
        lowerMessage.match(/^(r|reject)\s+([a-z]{2,3}\w+)/i)) {
      return handleSuperadminApproval(messageText, normalizedPhone);
    }
    
    // Check if Kishor is in a QR payment flow (awaiting screenshot or event)
    if (conversation.activeIntent === 'kishor_qr_payment') {
      let kishorContext: any = {};
      try {
        if (typeof conversation.intentContext === 'string') {
          kishorContext = JSON.parse(conversation.intentContext) || {};
        } else if (conversation.intentContext) {
          kishorContext = conversation.intentContext;
        }
      } catch { kishorContext = {}; }
      
      // Waiting for screenshot
      if (conversation.currentState === 'awaiting_payment_screenshot') {
        if (mediaUrl) {
          // Got screenshot, now ask for event assignment
          kishorContext.paymentScreenshotUrl = mediaUrl;
          
          await storage.updateWhatsappConversation(conversation.id, {
            intentContext: kishorContext,
            currentState: 'awaiting_event_assignment',
          });
          
          return `📸 Got your payment screenshot!\n\nWhich event should this expense be recorded under?\n\n_Type the customer/event name, or "general" for general expenses_`;
        } else {
          return `Please send your payment screenshot so I can forward it to the employee.`;
        }
      }
      
      // Waiting for event assignment
      if (conversation.currentState === 'awaiting_event_assignment') {
        const eventName = messageText.trim();
        const qrCode = kishorContext.qrCode;
        const paymentScreenshotUrl = kishorContext.paymentScreenshotUrl;
        
        // Reject empty/whitespace input or media-only messages
        if (!eventName || eventName.length === 0) {
          return `Please type the event/customer name, or "general" for general expenses.`;
        }
        
        // Complete the QR payment with screenshot and event
        const result = await handleQrPaymentComplete(qrCode, eventName, paymentScreenshotUrl);
        
        // Reset Kishor's conversation
        await storage.updateWhatsappConversation(conversation.id, {
          activeIntent: null,
          intentContext: null,
          currentState: 'idle',
        });
        
        return result;
      }
    }
    
    // Check if Kishor is in income approval flow (awaiting event assignment)
    if (conversation.activeIntent === 'kishor_income_approval') {
      let kishorContext: any = {};
      try {
        if (typeof conversation.intentContext === 'string') {
          kishorContext = JSON.parse(conversation.intentContext) || {};
        } else if (conversation.intentContext) {
          kishorContext = conversation.intentContext;
        }
      } catch { kishorContext = {}; }
      
      // Waiting for event assignment
      if (conversation.currentState === 'awaiting_income_event') {
        const eventName = messageText.trim();
        const incCode = kishorContext.incCode;
        
        if (!eventName || eventName.length === 0) {
          return `Please type the event/customer name, or "general" for general income.`;
        }
        
        // Complete the income approval with event
        const result = await handleIncomeApprovalComplete(incCode, eventName);
        
        // Reset Kishor's conversation
        await storage.updateWhatsappConversation(conversation.id, {
          activeIntent: null,
          intentContext: null,
          currentState: 'idle',
        });
        
        return result;
      }
    }
    
    // Handle Income approval commands (A INC001 or A INC001 EventName)
    const approveIncMatch = lowerMessage.match(/^a\s+(inc\d+)(?:\s+(.+))?/i);
    const rejectIncMatch = lowerMessage.match(/^(?:r|reject)\s+(inc\d+)(?:\s+(.+))?/i);
    
    if (approveIncMatch) {
      const incCode = approveIncMatch[1].toUpperCase();
      const eventName = approveIncMatch[2]?.trim() || 'General';
      const incomeSubmission = await storage.getIncomeSubmissionByCode(incCode);
      
      if (!incomeSubmission) {
        return `❌ ${incCode} not found.`;
      }
      
      if (incomeSubmission.status !== 'pending') {
        return `⚠️ ${incCode} already ${incomeSubmission.status}.`;
      }
      
      // Approve immediately and record in daybook
      await storage.updateIncomeSubmission(incomeSubmission.id, {
        status: 'approved',
        approvedAt: new Date(),
        eventAssignment: eventName,
      });
      
      const amount = parseFloat(incomeSubmission.amount);
      await storage.createDaybookEntry({
        date: new Date().toISOString().split('T')[0],
        type: 'income',
        category: incomeSubmission.type === 'bank_transfer' ? 'bank_transfer' : 'client_payment',
        description: `[${incCode}] ${incomeSubmission.description}`,
        amount: amount.toString(),
        mode: incomeSubmission.type === 'bank_transfer' ? 'bank' : 'upi',
        person: incomeSubmission.clientName,
        eventName: eventName === 'General' ? 'General' : eventName,
        approvedBy: 'Kishor',
        bankId: (incomeSubmission as any).bankId || null,
      });
      
      // Notify employee
      const employeePhone = incomeSubmission.employeePhone;
      if (employeePhone) {
        try {
          await sendWhatsAppMessage(employeePhone, `✅ *${incCode} Approved!*\n₹${amount.toLocaleString('en-IN')} from ${incomeSubmission.clientName}`);
        } catch (e) {
          console.error('[Income] Failed to notify employee:', e);
        }
      }
      
      return `✅ *${incCode}* approved\n₹${amount.toLocaleString('en-IN')} • ${eventName}`;
    }
    
    if (rejectIncMatch) {
      return handleIncomeReject(rejectIncMatch[1], rejectIncMatch[2]);
    }
    
    // Handle QR payment PAID command - simple one-message flow
    // Format: "PAID Fida" or "PAID Fida EventName" (uses employee first name)
    const paidMatch = lowerMessage.match(/^paid\s+(\w+)(?:\s+(.+))?/i);
    const rejectQrMatch = lowerMessage.match(/^reject\s+(qr\d+)(?:\s+(.+))?/i);
    
    if (paidMatch) {
      const nameOrCode = paidMatch[1];
      const eventName = paidMatch[2]?.trim() || 'General';
      
      // Find the pending QR request - either by code (QR001) or by employee first name
      let qrRequest;
      if (/^qr\d+$/i.test(nameOrCode)) {
        // Legacy: QR code format
        qrRequest = await storage.getQrPaymentRequestByCode(nameOrCode.toUpperCase());
      } else {
        // New: Employee first name - find most recent pending request
        qrRequest = await storage.getPendingQrPaymentByEmployeeName(nameOrCode);
      }
      
      if (!qrRequest) {
        return `❌ No pending payment found for "${nameOrCode}".`;
      }
      
      if (qrRequest.status !== 'pending') {
        return `⚠️ Payment already ${qrRequest.status}.`;
      }
      
      // Mark as paid immediately, store payment screenshot if provided
      await storage.updateQrPaymentRequest(qrRequest.id, {
        status: 'paid',
        paidAt: new Date(),
        eventAssignment: eventName,
        paymentScreenshotUrl: mediaUrl || null,
      });
      
      // Record in daybook
      const amount = parseFloat(qrRequest.amount);
      await storage.createDaybookEntry({
        date: new Date().toISOString().split('T')[0],
        type: 'expense',
        category: qrRequest.category || 'operations',
        description: `[${qrCode}] ${qrRequest.description}`,
        amount: amount.toString(),
        mode: 'upi',
        person: qrRequest.employeeName,
        eventName: eventName === 'General' ? 'General' : eventName,
        approvedBy: 'Kishor',
      });
      
      // Notify employee with payment screenshot if available
      const employeePhone = qrRequest.employeePhone;
      if (employeePhone) {
        try {
          const confirmMessage = `✅ *${qrCode} Paid!*\n₹${amount.toLocaleString('en-IN')} for ${qrRequest.description}`;
          
          if (mediaUrl) {
            // Send with payment screenshot
            const publicUrl = getPublicMediaUrl(mediaUrl);
            const { sendWhatsAppMediaMessage } = await import('./whatsapp-service');
            await sendWhatsAppMediaMessage(employeePhone, publicUrl, confirmMessage);
            console.log(`[QR] Sent payment screenshot to ${qrRequest.employeeName}`);
          } else {
            // Send text only
            await sendWhatsAppMessage(employeePhone, confirmMessage);
          }
        } catch (e) {
          console.error('[QR] Failed to notify employee:', e);
        }
      }
      
      return `✅ *${qrCode}* paid → ${qrRequest.employeeName}\n₹${amount.toLocaleString('en-IN')} • ${eventName}${mediaUrl ? '\n📸 Screenshot sent to employee' : ''}`;
    }
    
    if (rejectQrMatch) {
      return handleQrPaymentReject(rejectQrMatch[1], rejectQrMatch[2]);
    }
    
    // Handle Vendor Payment PAID command
    const paidVpMatch = lowerMessage.match(/^paid\s+(vp\d+)/i);
    
    if (paidVpMatch) {
      const vpCode = paidVpMatch[1].toUpperCase();
      const payment = await storage.getPendingVendorPaymentByCode(vpCode);
      
      if (!payment) {
        return `❌ Vendor payment ${vpCode} not found.`;
      }
      
      if (payment.status === 'paid') {
        return `⚠️ Vendor payment ${vpCode} was already marked as paid.`;
      }
      
      // Mark as paid and record in daybook
      return handleVendorPaymentPaid(vpCode);
    }
    
    // Handle lead submissions
    const isInLeadFlow = conversation.activeIntent === 'lead';
    const looksLikeLead = /lead|customer|client|enquiry|assign|fida|femina|\d{10}/i.test(messageText);
    
    if (isInLeadFlow || looksLikeLead) {
      const leadResponse = await handleSuperadminLeadMessage(messageText, normalizedPhone);
      if (leadResponse) {
        return leadResponse;
      }
    }
    
    // Default Kishor greeting - simplified
    return `👋 Hi Kishor!\n\n*Quick Commands:*\n• PAID Fida → Mark paid\n• PAID Fida EventName → Paid + assign event\n• A INC001 → Approve income\n• R CODE reason → Reject\n\n_Send lead info or ask anything!_ 🌳`;
  }
  
  const employee = conversation.employeeId 
    ? await storage.getEmployee(conversation.employeeId)
    : null;

  if (!employee) {
    return `👋 Hi! I'm Oaksy, your AI companion at Oakstreet Events.\n\n❌ I couldn't find your employee record. Please contact HR to ensure your phone number is registered.\n\n_Once registered, I can help you submit expenses and apply for leave!_ 🌳`;
  }
  
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

  if (lowerMessage === 'status' || lowerMessage === 'my status' || lowerMessage.includes('check status')) {
    return await getEmployeeStatus(employee.id, employee.name);
  }

  // VENDOR PAYMENT CORRECTION FLOW - Handle "no", "change", or amount corrections after vendor payment
  if (conversation.currentState === 'vendor_payment_recorded') {
    const lastCode = context.lastVendorPaymentCode as string | undefined;
    const lastAmount = context.lastVendorPaymentAmount as number | undefined;
    
    if (lastCode) {
      // Check for confirmation
      if (lowerMessage === 'ok' || lowerMessage === 'yes' || lowerMessage === 'confirm' || lowerMessage === 'correct') {
        await storage.updateWhatsappConversation(conversation.id, {
          activeIntent: null,
          intentContext: null,
          currentState: 'idle',
          conversationHistory: [],
        });
        return `✅ *Confirmed!* Vendor payment ${lastCode} has been recorded.\n\n_Kishor will be notified._ 🌳`;
      }
      
      // Check for correction - "no", "change to X", "make it X", or just a new amount
      const correctionPatterns = [
        /^no[,.]?\s*/i,
        /^change\s*(?:to|it)?\s*/i,
        /^make\s*it\s*/i,
        /^correct\s*(?:to|it)?\s*/i,
        /^update\s*(?:to|it)?\s*/i,
        /^wrong[,.]?\s*/i,
      ];
      
      let textAfterCorrection = messageText;
      let isCorrection = false;
      
      for (const pattern of correctionPatterns) {
        if (pattern.test(lowerMessage)) {
          textAfterCorrection = messageText.replace(pattern, '').trim();
          isCorrection = true;
          break;
        }
      }
      
      // Also treat any plain amount as a correction attempt
      const newAmount = extractAmount(textAfterCorrection) || extractAmount(messageText);
      
      if (newAmount && (isCorrection || newAmount !== lastAmount)) {
        // Update the vendor payment with new amount
        const payment = await storage.getPendingVendorPaymentByCode(lastCode);
        if (payment) {
          await storage.updatePendingVendorPayment(payment.id, {
            amount: newAmount.toString(),
          });
          
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: null,
            intentContext: null,
            currentState: 'idle',
            conversationHistory: [],
          });
          
          return `✅ *Amount Updated!*\n\n📋 Code: *${lastCode}*\n💰 New Amount: ₹${newAmount.toLocaleString('en-IN')}\n\n_Vendor payment has been corrected._ 🌳`;
        }
      }
      
      if (isCorrection && !newAmount) {
        return `What's the correct amount? 💰\n\n_Just send the number, e.g., "50000" or "1 lakh"_`;
      }
    }
    
    // If none of the above, reset and continue with normal flow
    await storage.updateWhatsappConversation(conversation.id, {
      activeIntent: null,
      intentContext: null,
      currentState: 'idle',
      conversationHistory: [],
    });
  }

  // INCOME SUBMISSION FLOW - Check if message indicates income/payment received
  if (mediaUrl && !conversation.activeIntent) {
    const incomeCheck = detectIncomeSubmission(messageText);
    
    if (incomeCheck.isIncome) {
      // This is an income submission (payment received screenshot)
      const providedAmount = extractAmount(messageText);
      const clientName = incomeCheck.clientName || 'Unknown Client';
      const incomeType = incomeCheck.type;
      
      if (providedAmount) {
        // Got amount - submit income for approval
        const requestCode = await storage.generateIncomeCode();
        const description = incomeType === 'bank_transfer' 
          ? `Bank transfer from ${clientName}`
          : `Payment received from ${clientName}`;
        
        await storage.createIncomeSubmission({
          requestCode,
          employeeId: employee.id,
          employeeName: employee.name,
          employeePhone: employee.phone || normalizedPhone,
          type: incomeType,
          clientName,
          description,
          amount: providedAmount.toString(),
          screenshotUrl: mediaUrl,
          status: 'pending',
        });

        // Notify Kishor for approval
        await notifyKishorIncomeSubmission(
          requestCode,
          employee.name,
          incomeType,
          clientName,
          description,
          providedAmount,
          mediaUrl
        );

        await storage.updateWhatsappConversation(conversation.id, {
          activeIntent: null,
          intentContext: null,
          currentState: 'idle',
          conversationHistory: [],
        });

        const typeLabel = incomeType === 'bank_transfer' ? 'Bank Transfer' : 'Client Payment';
        return `✅ *Income Submitted for Approval!*\n\n📋 Code: *${requestCode}*\n💰 Amount: ₹${providedAmount.toLocaleString('en-IN')}\n👤 From: ${clientName}\n📁 Type: ${typeLabel}\n\n_Kishor will review and record this in the daybook._ 🌳`;
      } else {
        // No amount - ask for amount
        await storage.updateWhatsappConversation(conversation.id, {
          activeIntent: 'income_submission',
          intentContext: { 
            incomeScreenshotUrl: mediaUrl,
            incomeClientName: clientName,
            incomeType: incomeType,
          },
          conversationHistory: history,
          currentState: 'awaiting_income_amount',
        });

        return `📥 Got your payment screenshot from ${clientName}!\n\nHow much was received? 💰`;
      }
    }
  }

  // TEXT-ONLY INCOME SUBMISSION - Detect income messages without screenshot
  // This runs for text-only messages (no mediaUrl) before falling through to other flows
  if (!mediaUrl && !conversation.activeIntent) {
    const incomeCheck = detectIncomeSubmission(messageText);
    
    if (incomeCheck.isIncome) {
      const providedAmount = extractAmount(messageText);
      const clientName = incomeCheck.clientName || 'Client';
      const incomeType = incomeCheck.type;
      const extractedBankName = incomeCheck.bankName;
      
      if (providedAmount) {
        // Got amount - submit income for approval
        const requestCode = await storage.generateIncomeCode();
        const description = incomeType === 'bank_transfer' 
          ? `Bank transfer from ${clientName}`
          : `Payment received from ${clientName}`;
        
        // Try to match bank name to existing banks
        let bankId: string | undefined;
        let resolvedBankName = extractedBankName;
        
        if (extractedBankName) {
          const banks = await storage.getAllBanks();
          const matchingBank = banks.find(b => 
            b.name.toLowerCase().includes(extractedBankName.toLowerCase()) ||
            extractedBankName.toLowerCase().includes(b.name.toLowerCase())
          );
          if (matchingBank) {
            bankId = matchingBank.id;
            resolvedBankName = matchingBank.name;
          }
        }
        
        await storage.createIncomeSubmission({
          requestCode,
          employeeId: employee.id,
          employeeName: employee.name,
          employeePhone: employee.phone || normalizedPhone,
          type: incomeType,
          clientName,
          description,
          amount: providedAmount.toString(),
          screenshotUrl: null,
          bankId: bankId || null,
          bankName: resolvedBankName || null,
          status: 'pending',
        });

        // Notify Kishor for approval
        await notifyKishorIncomeSubmission(
          requestCode,
          employee.name,
          incomeType,
          clientName,
          description,
          providedAmount,
          undefined,  // No screenshot
          resolvedBankName
        );

        await storage.updateWhatsappConversation(conversation.id, {
          activeIntent: null,
          intentContext: null,
          currentState: 'idle',
          conversationHistory: [],
        });

        const typeLabel = incomeType === 'bank_transfer' ? 'Bank Transfer' : 'Client Payment';
        const bankLabel = resolvedBankName ? `\n🏦 Bank: ${resolvedBankName}` : '';
        return `✅ *Income Submitted for Approval!*\n\n📋 Code: *${requestCode}*\n💰 Amount: ₹${providedAmount.toLocaleString('en-IN')}\n👤 From: ${clientName}\n📁 Type: ${typeLabel}${bankLabel}\n\n_Kishor will review and record this in the daybook._ 🌳`;
      } else {
        // No amount - ask for amount
        await storage.updateWhatsappConversation(conversation.id, {
          activeIntent: 'income_submission',
          intentContext: { 
            incomeClientName: clientName,
            incomeType: incomeType,
            incomeBankName: extractedBankName,
          },
          conversationHistory: history,
          currentState: 'awaiting_income_amount',
        });

        return `📥 *Income Submission*\n\n👤 From: ${clientName}\n\nHow much was received? 💰`;
      }
    }
  }

  // PENDING VENDOR PAYMENT FLOW - Detect "pending payment" messages
  const pendingCheck = detectPendingVendorPayment(messageText);
  if (pendingCheck.isPending) {
    const { vendorName, amount, eventName } = pendingCheck;
    
    if (vendorName && amount) {
      // Got vendor and amount - create the pending payment entry
      const requestCode = await storage.generateVendorPaymentCode();
      
      // Try to find the event if specified
      let eventId: string | undefined;
      let resolvedEventName = eventName;
      
      if (eventName) {
        const events = await storage.getAllEvents();
        const matchingEvent = events.find(e => 
          e.title.toLowerCase().includes(eventName.toLowerCase()) ||
          (e.customer && e.customer.toLowerCase().includes(eventName.toLowerCase()))
        );
        if (matchingEvent) {
          eventId = matchingEvent.id;
          resolvedEventName = matchingEvent.title;
        }
      }
      
      await storage.createPendingVendorPayment({
        requestCode,
        employeeId: employee.id,
        employeeName: employee.name,
        employeePhone: employee.phone || normalizedPhone,
        vendorName,
        amount: amount.toString(),
        eventId: eventId || null,
        eventName: resolvedEventName || null,
        description: messageText,
        status: 'pending',
      });

      // Notify Kishor about the pending vendor payment
      await notifyKishorPendingVendorPayment(
        requestCode,
        employee.name,
        vendorName,
        amount,
        resolvedEventName || 'Not specified'
      );

      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: null,
        intentContext: { lastVendorPaymentCode: requestCode, lastVendorPaymentAmount: amount },
        currentState: 'vendor_payment_recorded',
        conversationHistory: [],
      });

      return `✅ *Pending Vendor Payment Recorded!*\n\n📋 Code: *${requestCode}*\n🏪 Vendor: ${vendorName}\n💰 Amount: ₹${amount.toLocaleString('en-IN')}\n📅 Event: ${resolvedEventName || 'Not specified'}\n\n_Say "change to [amount]" to correct it, or type "ok" to confirm._`;
    } else if (vendorName) {
      // Got vendor but no amount - ask for amount
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: 'pending_vendor_payment',
        intentContext: { 
          vendorPaymentVendor: vendorName,
          vendorPaymentEvent: eventName,
        },
        conversationHistory: history,
        currentState: 'awaiting_vendor_amount',
      });

      return `📋 Vendor payment for *${vendorName}*\n\nWhat's the amount? 💰`;
    } else {
      // Got "vendor payment" but no vendor - ask for details
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: 'pending_vendor_payment',
        intentContext: {},
        conversationHistory: history,
        currentState: 'awaiting_vendor_details',
      });

      return `📋 *Vendor Payment*\n\nSend: Vendor name, Amount\n\n_Example: "Flower shop 5000"_\n_Or with event: "Flower shop 5000 Sharma Wedding"_`;
    }
  }

  // SIMPLIFIED QR PAYMENT FLOW - Any image is treated as QR payment request
  if (mediaUrl && !conversation.activeIntent) {
    context.qrImageUrl = mediaUrl;
    
    // Try to extract amount and purpose from the message
    const providedAmount = extractAmount(messageText);
    // Remove the amount from the message to get the purpose
    const purposeText = messageText.replace(/₹?\s*\d+[,\d]*\.?\d*/g, '').replace(/rs\.?\s*/gi, '').trim();
    
    if (providedAmount && purposeText.length > 2) {
      // Got both amount and purpose - submit immediately!
      context.amount = providedAmount;
      context.qrPaymentDescription = purposeText;
      context.qrPaymentCategory = 'Other'; // Default category
      
      const { requestCode } = await createQrPaymentRequest(
        employee.id,
        employee.name,
        employee.phone || normalizedPhone,
        'Other',
        purposeText,
        providedAmount,
        mediaUrl
      );

      await notifyKishorQrPayment(
        requestCode,
        employee.name,
        purposeText,
        providedAmount,
        mediaUrl
      );

      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: null,
        intentContext: null,
        currentState: 'idle',
        conversationHistory: [],
      });

      return `✅ *Sent to Kishor!*\n\n📋 Code: *${requestCode}*\n💰 Amount: ₹${providedAmount.toLocaleString('en-IN')}\n📝 For: ${purposeText}\n\n_You'll be notified once payment is done!_ 🌳`;
    } else if (providedAmount) {
      // Got amount but no purpose - just ask for purpose
      context.amount = providedAmount;
      
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: 'qr_payment',
        intentContext: context,
        conversationHistory: history,
        currentState: 'awaiting_qr_purpose_only',
      });

      const response = `💳 Got your QR! Amount: *₹${providedAmount.toLocaleString('en-IN')}*\n\nWhat's this payment for? 📝`;
      
      history.push({ role: 'assistant', content: response, timestamp: Date.now() });
      await storage.updateWhatsappConversation(conversation.id, { conversationHistory: history });
      
      return response;
    } else {
      // Got QR but no amount - ask for amount and purpose together
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: 'qr_payment',
        intentContext: context,
        conversationHistory: history,
        currentState: 'awaiting_qr_details',
      });

      const response = `💳 Got your QR code!\n\nPlease send amount and purpose.\n_Example: "500 for taxi" or "1200 lunch"_`;
      
      history.push({ role: 'assistant', content: response, timestamp: Date.now() });
      await storage.updateWhatsappConversation(conversation.id, { conversationHistory: history });
      
      return response;
    }
  }
  
  // Handle simplified QR payment flow states
  if (conversation.activeIntent === 'qr_payment') {
    // Waiting for just purpose (amount already provided)
    if (conversation.currentState === 'awaiting_qr_purpose_only') {
      context.qrPaymentDescription = messageText;
      context.qrPaymentCategory = 'Other';
      
      const { requestCode } = await createQrPaymentRequest(
        employee.id,
        employee.name,
        employee.phone || normalizedPhone,
        'Other',
        messageText,
        context.amount || 0,
        context.qrImageUrl || ''
      );

      await notifyKishorQrPayment(
        requestCode,
        employee.name,
        messageText,
        context.amount || 0,
        context.qrImageUrl || ''
      );

      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: null,
        intentContext: null,
        currentState: 'idle',
        conversationHistory: [],
      });

      return `✅ *Sent to Kishor!*\n\n📋 Code: *${requestCode}*\n💰 Amount: ₹${context.amount?.toLocaleString('en-IN')}\n📝 For: ${messageText}\n\n_You'll be notified once payment is done!_ 🌳`;
    }
    
    // Waiting for both amount and purpose
    if (conversation.currentState === 'awaiting_qr_details') {
      const amount = extractAmount(messageText);
      if (!amount) {
        return `Please include the amount. Example: "500 for taxi" or "₹1200 for lunch"`;
      }
      
      const purposeText = messageText.replace(/₹?\s*\d+[,\d]*\.?\d*/g, '').replace(/rs\.?\s*/gi, '').replace(/for\s+/i, '').trim() || 'Payment';
      
      context.amount = amount;
      context.qrPaymentDescription = purposeText;
      context.qrPaymentCategory = 'Other';
      
      const { requestCode } = await createQrPaymentRequest(
        employee.id,
        employee.name,
        employee.phone || normalizedPhone,
        'Other',
        purposeText,
        amount,
        context.qrImageUrl || ''
      );

      await notifyKishorQrPayment(
        requestCode,
        employee.name,
        purposeText,
        amount,
        context.qrImageUrl || ''
      );

      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: null,
        intentContext: null,
        currentState: 'idle',
        conversationHistory: [],
      });

      return `✅ *Sent to Kishor!*\n\n📋 Code: *${requestCode}*\n💰 Amount: ₹${amount.toLocaleString('en-IN')}\n📝 For: ${purposeText}\n\n_You'll be notified once payment is done!_ 🌳`;
    }
    
    // Legacy states - reset and ask to start over
    if (conversation.currentState === 'awaiting_qr_description' || 
        conversation.currentState === 'awaiting_qr_confirmation' ||
        conversation.currentState === 'awaiting_qr_category' ||
        conversation.currentState === 'awaiting_qr_amount') {
      // Reset to idle and ask to resend
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: null,
        intentContext: null,
        currentState: 'idle',
        conversationHistory: [],
      });
      
      return `Let's start fresh! Please send your QR code again with the amount and purpose.\n\n_Example: Send QR image with "500 for taxi"_`;
    }
  }

  // Handle income submission flow states
  if (conversation.activeIntent === 'income_submission') {
    // Waiting for amount after sending income screenshot
    if (conversation.currentState === 'awaiting_income_amount') {
      const amount = extractAmount(messageText);
      if (!amount) {
        return `Please tell me the amount received. Example: "₹50000" or "25000"`;
      }
      
      const incomeContext = context as any;
      const clientName = incomeContext.incomeClientName || 'Client';
      const incomeType = incomeContext.incomeType || 'client_payment';
      const screenshotUrl = incomeContext.incomeScreenshotUrl || '';
      
      const requestCode = await storage.generateIncomeCode();
      const description = incomeType === 'bank_transfer' 
        ? `Bank transfer from ${clientName}`
        : `Payment received from ${clientName}`;
      
      await storage.createIncomeSubmission({
        requestCode,
        employeeId: employee.id,
        employeeName: employee.name,
        employeePhone: employee.phone || normalizedPhone,
        type: incomeType,
        clientName,
        description,
        amount: amount.toString(),
        screenshotUrl,
        status: 'pending',
      });

      // Notify Kishor for approval
      await notifyKishorIncomeSubmission(
        requestCode,
        employee.name,
        incomeType,
        clientName,
        description,
        amount,
        screenshotUrl
      );

      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: null,
        intentContext: null,
        currentState: 'idle',
        conversationHistory: [],
      });

      const typeLabel = incomeType === 'bank_transfer' ? 'Bank Transfer' : 'Client Payment';
      return `✅ *Income Submitted for Approval!*\n\n📋 Code: *${requestCode}*\n💰 Amount: ₹${amount.toLocaleString('en-IN')}\n👤 From: ${clientName}\n📁 Type: ${typeLabel}\n\n_Kishor will review and record this in the daybook._ 🌳`;
    }
  }

  // Handle pending vendor payment state - awaiting amount
  if (conversation.currentState === 'awaiting_vendor_amount') {
    const amount = extractAmount(messageText);
    if (!amount) {
      return `Please send the amount. Example: "5000"`;
    }
    
    const vendorContext = context as any;
    const vendorName = vendorContext.vendorPaymentVendor || 'Unknown Vendor';
    const eventName = vendorContext.vendorPaymentEvent || undefined;
    
    // Create the pending payment entry
    const requestCode = await storage.generateVendorPaymentCode();
    
    // Try to find the event if specified
    let eventId: string | undefined;
    let resolvedEventName = eventName;
    
    if (eventName) {
      const events = await storage.getAllEvents();
      const matchingEvent = events.find(e => 
        e.title.toLowerCase().includes(eventName.toLowerCase()) ||
        (e.customer && e.customer.toLowerCase().includes(eventName.toLowerCase()))
      );
      if (matchingEvent) {
        eventId = matchingEvent.id;
        resolvedEventName = matchingEvent.title;
      }
    }
    
    await storage.createPendingVendorPayment({
      requestCode,
      employeeId: employee.id,
      employeeName: employee.name,
      employeePhone: employee.phone || normalizedPhone,
      vendorName,
      amount: amount.toString(),
      eventId: eventId || null,
      eventName: resolvedEventName || null,
      description: `Pending payment for ${vendorName}`,
      status: 'pending',
    });

    // Notify Kishor
    await notifyKishorPendingVendorPayment(
      requestCode,
      employee.name,
      vendorName,
      amount,
      resolvedEventName || 'Not specified'
    );

    await storage.updateWhatsappConversation(conversation.id, {
      activeIntent: null,
      intentContext: { lastVendorPaymentCode: requestCode, lastVendorPaymentAmount: amount },
      currentState: 'vendor_payment_recorded',
      conversationHistory: [],
    });

    return `✅ *Pending Vendor Payment Recorded!*\n\n📋 Code: *${requestCode}*\n🏪 Vendor: ${vendorName}\n💰 Amount: ₹${amount.toLocaleString('en-IN')}\n📅 Event: ${resolvedEventName || 'Not specified'}\n\n_Say "change to [amount]" to correct it, or type "ok" to confirm._`;
  }

  // Handle pending vendor payment state - awaiting full details
  if (conversation.currentState === 'awaiting_vendor_details') {
    // Parse format: "vendor name amount [event]"
    // Example: "Flower shop 5000" or "Flower shop 5000 Sharma Wedding"
    const amount = extractAmount(messageText);
    
    let vendorName: string | undefined;
    let eventName: string | undefined;
    
    if (amount) {
      // Find the amount in text and split around it
      const amountMatch = messageText.match(/(\d{1,3}(?:[,\d]*)?(?:\.\d+)?)/);
      if (amountMatch) {
        const amountIndex = messageText.indexOf(amountMatch[0]);
        const beforeAmount = messageText.substring(0, amountIndex).trim();
        const afterAmount = messageText.substring(amountIndex + amountMatch[0].length).trim();
        
        // Vendor name is before the amount
        vendorName = beforeAmount
          .replace(/[\-:,]+$/g, '')
          .replace(/^[\-:,]+/g, '')
          .replace(/\brs\.?\s*$/gi, '')
          .replace(/₹\s*$/g, '')
          .trim();
        
        // Event name is anything after the amount
        if (afterAmount && afterAmount.length > 1) {
          eventName = afterAmount
            .replace(/^[\-:,\s]+/g, '')
            .replace(/\bfor\s+/gi, '')
            .replace(/\bevent[\s:]+/gi, '')
            .trim();
        }
      }
    } else {
      // No amount - treat first part as vendor name
      const vendorMatch = messageText.match(/^([^₹\d]+)/);
      if (vendorMatch) {
        vendorName = vendorMatch[1].replace(/^[\s\-:]+|[\s\-:]+$/g, '').trim();
      }
    }
    
    if (!vendorName || vendorName.length < 2 || !amount) {
      return `❌ I need both vendor name and amount.\n\n_Example: "Flower shop 5000"_`;
    }
    
    // Create the pending payment entry
    const requestCode = await storage.generateVendorPaymentCode();
    
    // Try to find the event if specified
    let eventId: string | undefined;
    let resolvedEventName = eventName;
    
    if (eventName) {
      const events = await storage.getAllEvents();
      const matchingEvent = events.find(e => 
        e.title.toLowerCase().includes(eventName.toLowerCase()) ||
        (e.customer && e.customer.toLowerCase().includes(eventName.toLowerCase()))
      );
      if (matchingEvent) {
        eventId = matchingEvent.id;
        resolvedEventName = matchingEvent.title;
      }
    }
    
    await storage.createPendingVendorPayment({
      requestCode,
      employeeId: employee.id,
      employeeName: employee.name,
      employeePhone: employee.phone || normalizedPhone,
      vendorName,
      amount: amount.toString(),
      eventId: eventId || null,
      eventName: resolvedEventName || null,
      description: messageText,
      status: 'pending',
    });

    // Notify Kishor
    await notifyKishorPendingVendorPayment(
      requestCode,
      employee.name,
      vendorName,
      amount,
      resolvedEventName || 'Not specified'
    );

    await storage.updateWhatsappConversation(conversation.id, {
      activeIntent: null,
      intentContext: { lastVendorPaymentCode: requestCode, lastVendorPaymentAmount: amount },
      currentState: 'vendor_payment_recorded',
      conversationHistory: [],
    });

    return `✅ *Pending Vendor Payment Recorded!*\n\n📋 Code: *${requestCode}*\n🏪 Vendor: ${vendorName}\n💰 Amount: ₹${amount.toLocaleString('en-IN')}\n📅 Event: ${resolvedEventName || 'Not specified'}\n\n_Say "change to [amount]" to correct it, or type "ok" to confirm._`;
  }

  // Handle pending delivery challan states
  if (conversation.activeIntent === 'pending_delivery_challan') {
    // Handle confirmation state
    if (conversation.currentState === 'awaiting_dc_confirmation') {
      if (lowerMessage === 'yes' || lowerMessage === 'y' || lowerMessage === 'ok' || lowerMessage === 'confirm') {
        const dcContext = context as IntentContext;
        const deliverTo = dcContext.deliverTo || '';
        const deliveryAddress = dcContext.deliveryAddress || '';
        const amount = dcContext.amount;
        const itemDescription = dcContext.itemDescription || 'Stage Decor Items';
        const vehicleNumber = dcContext.vehicleNumber;
        
        // Validate all required fields are present
        if (!amount) {
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: 'pending_delivery_challan',
            intentContext: dcContext,
            currentState: 'awaiting_dc_amount',
            conversationHistory: history,
          });
          return `💰 I need the amount first. Please send the total amount.`;
        }
        if (!deliverTo) {
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: 'pending_delivery_challan',
            intentContext: dcContext,
            currentState: 'awaiting_dc_details',
            conversationHistory: history,
          });
          return `📍 I need the recipient name. Who should this be delivered to?`;
        }
        if (!deliveryAddress) {
          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: 'pending_delivery_challan',
            intentContext: dcContext,
            currentState: 'awaiting_dc_address',
            conversationHistory: history,
          });
          return `📍 I need the delivery address. What's the address?`;
        }
        
        try {
          const challanNumber = await storage.generateDeliveryChallanNumber();
          const items = [{
            description: itemDescription,
            hsnCode: '44219160',
            quantity: 1,
            unit: 'nos',
            rate: amount,
            amount: amount
          }];
          
          const cgstRate = 9;
          const sgstRate = 9;
          const subTotal = amount;
          const cgstAmount = subTotal * cgstRate / 100;
          const sgstAmount = subTotal * sgstRate / 100;
          const totalBeforeRounding = subTotal + cgstAmount + sgstAmount;
          const totalAmount = Math.round(totalBeforeRounding);
          const rounding = totalAmount - totalBeforeRounding;
          
          await storage.createDeliveryChallan({
            challanNumber,
            challanDate: new Date().toISOString().split('T')[0],
            challanType: 'Job Work',
            vehicleNumber: vehicleNumber || null,
            deliverTo,
            deliveryAddress,
            placeOfSupply: 'Kerala (32)',
            items,
            subTotal: subTotal.toFixed(2),
            cgstRate: cgstRate.toString(),
            cgstAmount: cgstAmount.toFixed(2),
            sgstRate: sgstRate.toString(),
            sgstAmount: sgstAmount.toFixed(2),
            rounding: rounding.toFixed(2),
            totalAmount: totalAmount.toFixed(2),
            totalInWords: `Indian Rupee ${numberToWords(totalAmount)} Only`,
            notes: `Created via Oaksy by ${employee.name}`,
            createdBy: employee.id,
          });

          await storage.updateWhatsappConversation(conversation.id, {
            activeIntent: null,
            intentContext: null,
            currentState: 'idle',
            conversationHistory: [],
          });

          const baseUrl = process.env.REPLIT_DEV_DOMAIN 
            ? `https://${process.env.REPLIT_DEV_DOMAIN}`
            : 'http://localhost:5000';
          
          const challans = await storage.getDeliveryChallans();
          const createdChallan = challans.find(c => c.challanNumber === challanNumber);
          const printUrl = createdChallan ? `${baseUrl}/print/delivery-challan/${createdChallan.id}` : '';

          return `✅ *Delivery Challan Created!*\n\n📋 Number: *${challanNumber}*\n📍 Deliver To: ${deliverTo}\n📦 Item: ${itemDescription}\n💰 Amount: ₹${amount.toLocaleString('en-IN')}\n💵 Total (incl. GST): ₹${totalAmount.toLocaleString('en-IN')}\n\n${printUrl ? `📄 View PDF: ${printUrl}` : ''}\n\n_Challan created successfully!_`;
        } catch (error: any) {
          console.error('[Oaksy] Delivery challan creation error:', error);
          return `❌ Error creating delivery challan. Please try again or use Oak Book in the app.`;
        }
      } else if (lowerMessage === 'no' || lowerMessage === 'n' || lowerMessage === 'cancel') {
        await storage.updateWhatsappConversation(conversation.id, {
          activeIntent: null,
          intentContext: null,
          currentState: 'idle',
          conversationHistory: [],
        });
        return `👍 Cancelled! Let me know if you need anything else.`;
      } else {
        return `Please reply *yes* to create the challan or *no* to cancel.`;
      }
    }
    
    // Awaiting delivery address
    if (conversation.currentState === 'awaiting_dc_address') {
      const dcContext = context as IntentContext;
      const deliverTo = dcContext.deliverTo || '';
      const existingAmount = dcContext.amount;
      
      // Try to extract amount from message (user might include it with address)
      const newAmount = extractAmount(messageText);
      
      // User provided address (keep all content)
      const deliveryAddress = messageText.trim();
      if (deliveryAddress.length < 5) {
        return `📍 Please provide a valid delivery address (minimum 5 characters).`;
      }
      
      // Use existing amount or newly extracted amount
      const finalAmount = existingAmount || newAmount;
      
      // Immutably merge context - preserve all existing fields and add new ones
      const updatedContext: IntentContext = { 
        ...dcContext, 
        deliveryAddress,
      };
      
      // Only add amount to context if we have one
      if (finalAmount) {
        updatedContext.amount = finalAmount;
      }
      
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: 'pending_delivery_challan',
        intentContext: updatedContext,
        currentState: finalAmount ? 'awaiting_dc_confirmation' : 'awaiting_dc_amount',
        conversationHistory: history,
      });
      
      if (finalAmount) {
        return `📋 *Delivery Challan Summary*\n\n📍 Deliver To: ${deliverTo}\n📍 Address: ${deliveryAddress}\n💰 Amount: ₹${finalAmount.toLocaleString('en-IN')}\n\n*Ready to create?* Reply "yes" to confirm.`;
      }
      
      return `📍 Got the address!\n\nNow, what's the total amount? 💰`;
    }
    
    // Awaiting amount
    if (conversation.currentState === 'awaiting_dc_amount') {
      const amount = extractAmount(messageText);
      if (!amount) {
        return `Please send the amount. Example: "5000" or "₹15000"`;
      }
      
      const dcContext = context as IntentContext;
      const deliverTo = dcContext.deliverTo || '';
      const deliveryAddress = dcContext.deliveryAddress || '';
      
      // Immutably merge context with new amount
      const updatedContext: IntentContext = { ...dcContext, amount };
      
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: 'pending_delivery_challan',
        intentContext: updatedContext,
        currentState: 'awaiting_dc_confirmation',
        conversationHistory: history,
      });
      
      return `📋 *Delivery Challan Summary*\n\n📍 Deliver To: ${deliverTo}\n📍 Address: ${deliveryAddress}\n💰 Amount: ₹${amount.toLocaleString('en-IN')}\n\n*Ready to create?* Reply "yes" to confirm or "no" to cancel.`;
    }
    
    // Awaiting full details (generic state)
    if (conversation.currentState === 'awaiting_dc_details') {
      // Try to parse: "DC to [name], [address], [amount]"
      const amount = extractAmount(messageText);
      
      // Simple parsing - look for "to" keyword
      let deliverTo = '';
      let deliveryAddress = '';
      
      // Try comma-separated format
      const parts = messageText.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        // First part is deliver to
        deliverTo = parts[0].replace(/^(dc|challan|delivery)\s*(to|for)?\s*/i, '').trim();
        deliveryAddress = parts.slice(1, -1).join(', ').trim() || parts[1];
      } else {
        // Look for "to" pattern
        const toMatch = messageText.match(/(?:dc|challan|delivery)?\s*to\s+(.+)/i);
        if (toMatch) {
          deliverTo = toMatch[1].split(/[\-,]/)[0].trim();
        } else {
          deliverTo = messageText.replace(/^(dc|challan|delivery)\s*/i, '').trim().split(/\s+/).slice(0, 3).join(' ');
        }
      }
      
      const dcContext = context as IntentContext;
      
      if (deliverTo && amount) {
        // Have deliver to and amount, need address - merge with existing context
        const updatedContext: IntentContext = { ...dcContext, deliverTo, amount };
        await storage.updateWhatsappConversation(conversation.id, {
          activeIntent: 'pending_delivery_challan',
          intentContext: updatedContext,
          currentState: 'awaiting_dc_address',
          conversationHistory: history,
        });
        return `📋 *Delivery Challan* for *${deliverTo}*\n\nAmount: ₹${amount.toLocaleString('en-IN')}\n\nWhat's the delivery address? 📍`;
      } else if (deliverTo) {
        // Have deliver to, need address and amount - merge with existing context
        const updatedContext: IntentContext = { ...dcContext, deliverTo };
        await storage.updateWhatsappConversation(conversation.id, {
          activeIntent: 'pending_delivery_challan',
          intentContext: updatedContext,
          currentState: 'awaiting_dc_address',
          conversationHistory: history,
        });
        return `📋 *Delivery Challan* for *${deliverTo}*\n\nWhat's the delivery address? 📍`;
      }
      
      return `❌ I need at least a recipient name.\n\n_Example: "DC to ABC Wedding Hall"_`;
    }
  }

  // Handle amount without image (text-only expense submission)
  const directAmount = extractAmount(messageText);
  if (directAmount && !context.amount && !mediaUrl && !conversation.activeIntent) {
    context.amount = directAmount;
    
    await storage.updateWhatsappConversation(conversation.id, {
      activeIntent: 'expense',
      intentContext: context,
      conversationHistory: history,
      currentState: 'awaiting_expense_purpose',
    });

    const response = `💰 Got it! ₹${directAmount.toLocaleString('en-IN')}.\n\nWhat was this expense for? 📝`;
    
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

    // Role-aware greeting
    const isWeddingPlanner = employee.name.toLowerCase().includes('fida') || employee.name.toLowerCase().includes('femina');
    
    if (isWeddingPlanner) {
      return `👋 Hi ${employee.name}! I'm *Oaksy AI*, your assistant at Oakstreet Events 🌳\n\n*I can help you with:*\n\n🏪 *Vendor Payments* - Just say "vendor payment [name] [amount]"\n📋 *Delivery Challan* - Say "DC to [venue] [amount]"\n💰 *Submit Expenses* - Send the amount or receipt\n💳 *QR Payment* - Send QR code for direct payment\n📅 *Leave Requests* - Say "leave" or "vacation"\n\n_Tell me what you need!_`;
    }

    return `👋 Hi ${employee.name}! I'm *Oaksy AI*, your companion at Oakstreet Events 🌳\n\n*Here's what I can help with:*\n\n💰 *Submit Expenses* - Just send the amount or a receipt photo\n💳 *QR Payment* - Send QR code with "pay" for direct payment\n📅 *Apply for Leave* - Say "sick leave" or "vacation"\n📋 *Check Status* - Type "status" to see your requests\n\n_Just tell me what you need!_`;
  }

  // Use AI to understand the message when no pattern matches
  // Determine employee role based on name or job title
  let employeeRole = 'employee';
  if (employee.name.toLowerCase().includes('fida') || employee.name.toLowerCase().includes('femina')) {
    employeeRole = 'wedding_planner';
  } else if (employee.jobTitle?.toLowerCase().includes('accountant')) {
    employeeRole = 'accountant';
  } else if (employee.jobTitle?.toLowerCase().includes('manager')) {
    employeeRole = 'manager';
  }
  
  const aiAnalysis = await analyzeWithAI(
    messageText,
    context,
    history,
    !!mediaUrl,
    employeeRole,
    employee.name
  );

  // Handle AI-detected vendor payment intent
  if (aiAnalysis.intent === 'vendor_payment') {
    const vendorName = aiAnalysis.extractedData.vendorName;
    const amount = aiAnalysis.extractedData.amount || extractAmount(messageText);
    const eventName = aiAnalysis.extractedData.eventName;
    
    if (vendorName && amount) {
      // Got vendor and amount - create the pending payment entry
      const requestCode = await storage.generateVendorPaymentCode();
      
      // Try to find the event if specified
      let eventId: string | undefined;
      let resolvedEventName = eventName;
      
      if (eventName) {
        const events = await storage.getAllEvents();
        const matchingEvent = events.find(e => 
          e.title.toLowerCase().includes(eventName.toLowerCase()) ||
          (e.customer && e.customer.toLowerCase().includes(eventName.toLowerCase()))
        );
        if (matchingEvent) {
          eventId = matchingEvent.id;
          resolvedEventName = matchingEvent.title;
        }
      }
      
      await storage.createPendingVendorPayment({
        requestCode,
        employeeId: employee.id,
        employeeName: employee.name,
        employeePhone: employee.phone || normalizedPhone,
        vendorName,
        amount: amount.toString(),
        eventId: eventId || null,
        eventName: resolvedEventName || null,
        description: messageText,
        status: 'pending',
      });

      await notifyKishorPendingVendorPayment(
        requestCode,
        employee.name,
        vendorName,
        amount,
        resolvedEventName || 'Not specified'
      );

      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: null,
        intentContext: { lastVendorPaymentCode: requestCode, lastVendorPaymentAmount: amount },
        currentState: 'vendor_payment_recorded',
        conversationHistory: [],
      });

      return `✅ *Vendor Payment Recorded!*\n\n📋 Code: *${requestCode}*\n🏪 Vendor: ${vendorName}\n💰 Amount: ₹${amount.toLocaleString('en-IN')}\n📅 Event: ${resolvedEventName || 'Not specified'}\n\n_Say "change to [amount]" to correct it, or type "ok" to confirm._`;
    } else if (vendorName) {
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: 'pending_vendor_payment',
        intentContext: { 
          vendorPaymentVendor: vendorName,
          vendorPaymentEvent: eventName,
        },
        conversationHistory: history,
        currentState: 'awaiting_vendor_amount',
      });

      return `📋 Vendor payment for *${vendorName}*\n\nWhat's the amount? 💰`;
    } else {
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: 'pending_vendor_payment',
        intentContext: {},
        conversationHistory: history,
        currentState: 'awaiting_vendor_details',
      });

      return aiAnalysis.message || `📋 *Vendor Payment*\n\nWhich vendor and how much?\n\n_Example: "Flower shop 5000"_`;
    }
  }

  // Handle AI-detected delivery challan intent (wedding planners and accountants only)
  if (aiAnalysis.intent === 'delivery_challan') {
    const isWeddingPlanner = employee.name.toLowerCase().includes('fida') || employee.name.toLowerCase().includes('femina');
    const isAccountant = employee.jobTitle?.toLowerCase().includes('accountant');
    const isSuperadmin = employee.jobTitle?.toLowerCase().includes('superadmin') || employee.name.toLowerCase().includes('kishor');
    
    if (!isWeddingPlanner && !isAccountant && !isSuperadmin) {
      return `❌ Sorry ${employee.name}, delivery challans can only be created by wedding planners, accountants, or admin.\n\n_Need to create one? Please contact Fida or Femina._`;
    }
    
    const deliverTo = aiAnalysis.extractedData.deliverTo || context.deliverTo;
    const deliveryAddress = aiAnalysis.extractedData.deliveryAddress || context.deliveryAddress;
    const amount = aiAnalysis.extractedData.amount || context.amount || extractAmount(messageText);
    const itemDescription = aiAnalysis.extractedData.itemDescription || context.itemDescription || 'Stage Decor Items';
    const vehicleNumber = aiAnalysis.extractedData.vehicleNumber || context.vehicleNumber;
    
    if (deliverTo && deliveryAddress && amount) {
      // All required info collected - go to confirmation
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: 'pending_delivery_challan',
        intentContext: { deliverTo, deliveryAddress, amount, itemDescription, vehicleNumber },
        conversationHistory: history,
        currentState: 'awaiting_dc_confirmation',
      });
      return `📋 *Delivery Challan Summary*\n\n📍 Deliver To: ${deliverTo}\n📍 Address: ${deliveryAddress}\n💰 Amount: ₹${amount.toLocaleString('en-IN')}\n\n*Ready to create?* Reply "yes" to confirm or "no" to cancel.`;
    } else if (deliverTo && deliveryAddress) {
      // Have recipient and address, need amount
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: 'pending_delivery_challan',
        intentContext: { deliverTo, deliveryAddress, itemDescription },
        conversationHistory: history,
        currentState: 'awaiting_dc_amount',
      });
      return `📋 *Delivery Challan*\n\nDelivering to: *${deliverTo}*\n\nWhat's the total amount? 💰`;
    } else if (deliverTo) {
      // Have recipient, need address
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: 'pending_delivery_challan',
        intentContext: { deliverTo, amount },
        conversationHistory: history,
        currentState: 'awaiting_dc_address',
      });
      return `📋 *Delivery Challan* for *${deliverTo}*\n\nWhat's the delivery address? 📍`;
    } else {
      // Need all details
      await storage.updateWhatsappConversation(conversation.id, {
        activeIntent: 'pending_delivery_challan',
        intentContext: {},
        conversationHistory: history,
        currentState: 'awaiting_dc_details',
      });
      return aiAnalysis.message || `📋 *Create Delivery Challan*\n\nPlease provide:\n1. Deliver to (name/company)\n2. Delivery address\n3. Amount\n\n_Example: "DC to ABC Wedding Hall, Kochi, 15000"_`;
    }
  }

  // Return AI's response for other intents
  if (aiAnalysis.message && aiAnalysis.intent !== 'general') {
    history.push({ role: 'assistant', content: aiAnalysis.message, timestamp: Date.now() });
    await storage.updateWhatsappConversation(conversation.id, { conversationHistory: history });
    return aiAnalysis.message;
  }

  // Default greeting with role-aware tips
  const isWeddingPlanner = employee.name.toLowerCase().includes('fida') || employee.name.toLowerCase().includes('femina');
  
  if (isWeddingPlanner) {
    return `👋 Hi ${employee.name}! I'm Oaksy 🌳\n\n*Quick tips:*\n• "vendor payment [name] [amount]" for payments\n• Send receipt photo for expenses\n• Say "leave" to apply for time off\n\n_How can I help?_`;
  }

  return `👋 Hi ${employee.name}! I'm Oaksy 🌳\n\n*Quick tips:*\n• Send an amount like "500" for expenses\n• Send QR code for payment requests\n• Say "leave" to apply for time off\n\n_How can I help you today?_`;
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

// QR Payment Request Handlers
async function handleQrPaymentPaid(
  code: string,
  eventNameOrGeneral?: string,
  paymentScreenshotUrl?: string
): Promise<string> {
  const qrRequest = await storage.getQrPaymentRequestByCode(code.toUpperCase());
  
  if (!qrRequest) {
    return `❌ QR Payment Request ${code.toUpperCase()} not found.`;
  }
  
  if (qrRequest.status !== 'pending') {
    return `⚠️ QR Request ${code.toUpperCase()} was already ${qrRequest.status}.`;
  }
  
  // Update QR request as paid
  const eventName = eventNameOrGeneral?.trim() || 'General';
  const isGeneralExpense = eventName.toLowerCase() === 'general' || !eventNameOrGeneral;
  
  // Try to find event if specified
  let eventId: string | null = null;
  if (!isGeneralExpense) {
    const events = await storage.getAllEvents();
    const matchingEvent = events.find(e => 
      e.customer?.toLowerCase().includes(eventName.toLowerCase()) ||
      e.venue?.toLowerCase().includes(eventName.toLowerCase())
    );
    if (matchingEvent) {
      eventId = matchingEvent.id;
    }
  }
  
  await storage.updateQrPaymentRequest(qrRequest.id, {
    status: 'paid',
    paymentScreenshotUrl: paymentScreenshotUrl || null,
    eventId,
    eventName: isGeneralExpense ? 'General' : eventName,
    paidAt: new Date(),
  });
  
  // Create daybook entry
  const today = new Date().toISOString().split('T')[0];
  const daybookEntry = await storage.createDaybookEntry({
    date: today,
    type: 'expense',
    amount: qrRequest.amount,
    category: qrRequest.category,
    description: `QR Payment: ${qrRequest.description} (${qrRequest.employeeName})`,
    eventId,
    eventName: isGeneralExpense ? null : eventName,
  });
  
  // Update QR request with daybook entry link
  await storage.updateQrPaymentRequest(qrRequest.id, {
    status: 'recorded',
    daybookEntryId: daybookEntry.id,
    recordedAt: new Date(),
  });
  
  // Notify employee
  const notifyMessage = `🎉 *Payment Confirmed!*\n\n✅ Your payment request *${qrRequest.requestCode}* has been processed.\n\n💰 Amount: ₹${parseFloat(qrRequest.amount).toLocaleString('en-IN')}\n📝 For: ${qrRequest.description}\n📋 Recorded under: ${isGeneralExpense ? 'General Expenses' : eventName}\n\n_Thank you!_ 🌳`;
  
  await sendWhatsAppMessage(qrRequest.employeePhone, notifyMessage);
  
  return `✅ *Payment Recorded* - ${qrRequest.requestCode}\n\n💰 ₹${parseFloat(qrRequest.amount).toLocaleString('en-IN')}\n📝 ${qrRequest.description}\n📋 Added to: ${isGeneralExpense ? 'General Expenses' : eventName}\n\n_Employee notified & Daybook updated!_`;
}

async function handleQrPaymentReject(
  code: string,
  reason?: string
): Promise<string> {
  const qrRequest = await storage.getQrPaymentRequestByCode(code.toUpperCase());
  
  if (!qrRequest) {
    return `❌ QR Payment Request ${code.toUpperCase()} not found.`;
  }
  
  if (qrRequest.status !== 'pending') {
    return `⚠️ QR Request ${code.toUpperCase()} was already ${qrRequest.status}.`;
  }
  
  const rejectReason = reason?.trim() || 'Not approved';
  
  await storage.updateQrPaymentRequest(qrRequest.id, {
    status: 'rejected',
    rejectionReason: rejectReason,
  });
  
  // Notify employee
  const notifyMessage = `ℹ️ *Payment Request Update*\n\nYour payment request *${qrRequest.requestCode}* was not approved.\n\n*Reason:* ${rejectReason}\n\n_Please contact your manager if you have questions._`;
  
  await sendWhatsAppMessage(qrRequest.employeePhone, notifyMessage);
  
  return `❌ *Rejected* - ${qrRequest.requestCode}\n*Reason:* ${rejectReason}\n\n_Employee notified._`;
}

async function handleQrPaymentComplete(
  code: string,
  eventNameOrGeneral: string,
  paymentScreenshotUrl?: string
): Promise<string> {
  const qrRequest = await storage.getQrPaymentRequestByCode(code.toUpperCase());
  
  if (!qrRequest) {
    return `❌ QR Payment Request ${code.toUpperCase()} not found.`;
  }
  
  if (qrRequest.status !== 'paid') {
    return `⚠️ QR Request ${code.toUpperCase()} is in ${qrRequest.status} state.`;
  }
  
  // Determine event assignment - treat empty/blank as "General"
  const rawEventName = eventNameOrGeneral?.trim() || '';
  const isGeneralExpense = !rawEventName || rawEventName.toLowerCase() === 'general';
  const eventName = isGeneralExpense ? 'General' : rawEventName;
  
  // Try to find event if specified (only if not general and has meaningful search term)
  let eventId: string | null = null;
  if (!isGeneralExpense && eventName.length >= 2) {
    const events = await storage.getAllEvents();
    const matchingEvent = events.find(e => 
      e.customer?.toLowerCase().includes(eventName.toLowerCase()) ||
      e.venue?.toLowerCase().includes(eventName.toLowerCase())
    );
    if (matchingEvent) {
      eventId = matchingEvent.id;
    }
  }
  
  // Update QR request with screenshot and event
  await storage.updateQrPaymentRequest(qrRequest.id, {
    paymentScreenshotUrl: paymentScreenshotUrl || null,
    eventId,
    eventName: isGeneralExpense ? 'General' : eventName,
  });
  
  // Create daybook entry
  const today = new Date().toISOString().split('T')[0];
  const daybookEntry = await storage.createDaybookEntry({
    date: today,
    type: 'expense',
    amount: qrRequest.amount,
    category: qrRequest.category || 'Other',
    description: `QR Payment: ${qrRequest.description} (${qrRequest.employeeName})`,
    eventId,
    eventName: isGeneralExpense ? null : eventName,
  });
  
  // Update QR request with daybook entry link
  await storage.updateQrPaymentRequest(qrRequest.id, {
    status: 'recorded',
    daybookEntryId: daybookEntry.id,
    recordedAt: new Date(),
  });
  
  // Send screenshot to employee with confirmation
  if (paymentScreenshotUrl) {
    try {
      const { sendWhatsAppMediaMessage } = await import('./whatsapp-service');
      await sendWhatsAppMediaMessage(
        qrRequest.employeePhone,
        paymentScreenshotUrl,
        `🎉 *Payment Complete!*\n\n✅ Your request *${qrRequest.requestCode}* has been paid!\n\n💰 Amount: ₹${parseFloat(qrRequest.amount).toLocaleString('en-IN')}\n📝 For: ${qrRequest.description}\n📋 Recorded under: ${isGeneralExpense ? 'General Expenses' : eventName}\n\n_Thank you!_ 🌳`
      );
    } catch (error) {
      // Fallback to text message if media fails
      const notifyMessage = `🎉 *Payment Complete!*\n\n✅ Your request *${qrRequest.requestCode}* has been paid!\n\n💰 Amount: ₹${parseFloat(qrRequest.amount).toLocaleString('en-IN')}\n📝 For: ${qrRequest.description}\n📋 Recorded under: ${isGeneralExpense ? 'General Expenses' : eventName}\n\n_Thank you!_ 🌳`;
      await sendWhatsAppMessage(qrRequest.employeePhone, notifyMessage);
    }
  } else {
    const notifyMessage = `🎉 *Payment Complete!*\n\n✅ Your request *${qrRequest.requestCode}* has been paid!\n\n💰 Amount: ₹${parseFloat(qrRequest.amount).toLocaleString('en-IN')}\n📝 For: ${qrRequest.description}\n📋 Recorded under: ${isGeneralExpense ? 'General Expenses' : eventName}\n\n_Thank you!_ 🌳`;
    await sendWhatsAppMessage(qrRequest.employeePhone, notifyMessage);
  }
  
  return `✅ *Payment Recorded* - ${qrRequest.requestCode}\n\n💰 ₹${parseFloat(qrRequest.amount).toLocaleString('en-IN')}\n📝 ${qrRequest.description}\n📋 Added to: ${isGeneralExpense ? 'General Expenses' : eventName}\n\n_Employee notified with screenshot & Daybook updated!_`;
}

async function createQrPaymentRequest(
  employeeId: string,
  employeeName: string,
  employeePhone: string,
  category: string,
  description: string,
  amount: number,
  qrImageUrl: string
): Promise<{ requestCode: string }> {
  const requestCode = await storage.generateQrPaymentCode();
  
  await storage.createQrPaymentRequest({
    requestCode,
    employeeId,
    employeeName,
    employeePhone,
    category,
    description,
    amount: amount.toString(),
    qrImageUrl,
    status: 'pending',
  });
  
  return { requestCode };
}

async function notifyKishorQrPayment(
  requestCode: string,
  employeeName: string,
  description: string,
  amount: number,
  qrImageUrl: string
): Promise<void> {
  console.log(`[QR Payment] Notifying Kishor about ${requestCode} from ${employeeName}`);
  
  // Extract first name for the command
  const firstName = employeeName.split(' ')[0];
  
  try {
    if (qrImageUrl) {
      try {
        // Convert Twilio authenticated URL to public URL
        const publicUrl = getPublicMediaUrl(qrImageUrl);
        console.log('[QR Payment] Using public URL:', publicUrl);
        
        const { sendWhatsAppMediaMessage } = await import('./whatsapp-service');
        await sendWhatsAppMediaMessage(
          SUPERADMIN_WHATSAPP, 
          publicUrl,
          `💳 *${firstName}* needs *₹${amount.toLocaleString('en-IN')}*\n📝 ${description}\n\n_Reply "PAID ${firstName}" after payment_`
        );
        console.log(`[QR Payment] Notification sent successfully for ${requestCode}`);
      } catch (mediaError: any) {
        // Fallback to text-only if media fails
        console.error('[QR Payment] Failed to send media, falling back to text:', mediaError.message);
        const message = `💳 *${firstName}* needs *₹${amount.toLocaleString('en-IN')}*\n📝 ${description}\n\n📷 QR: ${qrImageUrl}\n\n_Reply "PAID ${firstName}" after payment_`;
        await sendWhatsAppMessage(SUPERADMIN_WHATSAPP, message);
      }
    } else {
      const message = `💳 *${firstName}* needs *₹${amount.toLocaleString('en-IN')}*\n📝 ${description}\n\n_Reply "PAID ${firstName}" after payment_`;
      await sendWhatsAppMessage(SUPERADMIN_WHATSAPP, message);
      console.log(`[QR Payment] Text notification sent for ${requestCode}`);
    }
  } catch (error: any) {
    console.error(`[QR Payment] CRITICAL: Failed to notify Kishor about ${requestCode}:`, error.message);
    // Try one more time with just text
    try {
      const fallbackMessage = `💳 ${firstName} needs ₹${amount} for ${description}. Reply PAID ${firstName} after payment.`;
      await sendWhatsAppMessage(SUPERADMIN_WHATSAPP, fallbackMessage);
    } catch (fallbackError: any) {
      console.error('[QR Payment] Even fallback failed:', fallbackError.message);
    }
  }
}

// Income submission notification to Kishor
async function notifyKishorIncomeSubmission(
  requestCode: string,
  employeeName: string,
  type: 'client_payment' | 'bank_transfer',
  clientName: string,
  description: string,
  amount: number,
  screenshotUrl?: string,
  bankName?: string
): Promise<void> {
  const typeLabel = type === 'bank_transfer' ? 'Bank Transfer' : 'Client Payment';
  const bankLabel = bankName ? `\n🏦 *Bank:* ${bankName}` : '';
  
  if (screenshotUrl) {
    try {
      // Convert Twilio authenticated URL to public URL
      const publicUrl = await getPublicMediaUrl(screenshotUrl);
      console.log('[Income] Using public URL:', publicUrl);
      
      const { sendWhatsAppMediaMessage } = await import('./whatsapp-service');
      await sendWhatsAppMediaMessage(
        SUPERADMIN_WHATSAPP, 
        publicUrl,
        `📥 *Income Submission ${requestCode}*\n\n👤 From: ${employeeName}\n📁 Type: ${typeLabel}\n👥 Client: ${clientName}\n💰 Amount: *₹${amount.toLocaleString('en-IN')}*${bankLabel}\n\n_Reply "A ${requestCode}" to approve_`
      );
    } catch (mediaError) {
      console.error('[Income] Failed to send media, falling back to text:', mediaError);
      const message = `📥 *Income Submission ${requestCode}*\n━━━━━━━━━━━━━━━━━━\n\n👤 *From:* ${employeeName}\n📁 *Type:* ${typeLabel}\n👥 *Client:* ${clientName}\n💰 *Amount:* ₹${amount.toLocaleString('en-IN')}${bankLabel}\n\n📷 Screenshot: ${screenshotUrl}\n\n_Reply "A ${requestCode}" to approve_\n_Reply "R ${requestCode} reason" to reject_\n\n🌳 Oaksy`;
      await sendWhatsAppMessage(SUPERADMIN_WHATSAPP, message);
    }
  } else {
    const message = `📥 *Income Submission ${requestCode}*\n━━━━━━━━━━━━━━━━━━\n\n👤 *From:* ${employeeName}\n📁 *Type:* ${typeLabel}\n👥 *Client:* ${clientName}\n💰 *Amount:* ₹${amount.toLocaleString('en-IN')}${bankLabel}\n\n_Reply "A ${requestCode}" to approve_\n_Reply "R ${requestCode} reason" to reject_\n\n🌳 Oaksy`;
    await sendWhatsAppMessage(SUPERADMIN_WHATSAPP, message);
  }
}

// Notify Kishor about a new pending vendor payment
async function notifyKishorPendingVendorPayment(
  requestCode: string,
  employeeName: string,
  vendorName: string,
  amount: number,
  eventName: string
): Promise<void> {
  const message = `🏪 *Pending Vendor Payment ${requestCode}*\n━━━━━━━━━━━━━━━━━━\n\n👤 *Submitted by:* ${employeeName}\n🏢 *Vendor:* ${vendorName}\n💰 *Amount:* ₹${amount.toLocaleString('en-IN')}\n📅 *Event:* ${eventName}\n\n_Reply "PAID ${requestCode}" when payment is made_\n\n🌳 Oaksy`;
  await sendWhatsAppMessage(SUPERADMIN_WHATSAPP, message);
}

// Mark vendor payment as paid and record in daybook
async function handleVendorPaymentPaid(
  code: string,
  eventNameOrGeneral?: string
): Promise<string> {
  const payment = await storage.getPendingVendorPaymentByCode(code.toUpperCase());
  
  if (!payment) {
    return `❌ Vendor payment ${code.toUpperCase()} not found.`;
  }
  
  if (payment.status === 'paid') {
    return `⚠️ Vendor payment ${code.toUpperCase()} was already marked as paid.`;
  }
  
  // Determine event assignment
  const rawEventName = eventNameOrGeneral?.trim() || payment.eventName || '';
  const isGeneralExpense = !rawEventName || rawEventName.toLowerCase() === 'general';
  const eventName = isGeneralExpense ? 'General' : rawEventName;
  
  // Try to find event if specified
  let eventId: string | null = payment.eventId || null;
  if (!isGeneralExpense && eventName.length >= 2 && !eventId) {
    const events = await storage.getAllEvents();
    const matchingEvent = events.find(e => 
      e.customer?.toLowerCase().includes(eventName.toLowerCase()) ||
      e.venue?.toLowerCase().includes(eventName.toLowerCase()) ||
      e.title?.toLowerCase().includes(eventName.toLowerCase())
    );
    if (matchingEvent) {
      eventId = matchingEvent.id;
    }
  }
  
  // Create daybook entry as expense
  const today = new Date().toISOString().split('T')[0];
  const daybookEntry = await storage.createDaybookEntry({
    date: today,
    type: 'expense',
    amount: payment.amount,
    category: 'Vendor Payment',
    description: `Payment to ${payment.vendorName} (via ${payment.employeeName})`,
    eventId,
    eventName: isGeneralExpense ? null : eventName,
    vendorName: payment.vendorName,
  });
  
  // Update payment as paid
  await storage.updatePendingVendorPayment(payment.id, {
    status: 'paid',
    eventId,
    eventName: isGeneralExpense ? 'General' : eventName,
    daybookEntryId: daybookEntry.id,
    paidAt: new Date(),
  });

  // Notify employee
  await sendWhatsAppMessage(
    payment.employeePhone,
    `✅ *Payment Made!*\n\nYour pending vendor payment *${payment.requestCode}* to *${payment.vendorName}* for ₹${parseFloat(payment.amount).toLocaleString('en-IN')} has been paid.\n\n🌳 Oaksy`
  );
  
  return `✅ Vendor payment ${code.toUpperCase()} marked as PAID!\n\n🏪 Vendor: ${payment.vendorName}\n💰 Amount: ₹${parseFloat(payment.amount).toLocaleString('en-IN')}\n📅 Event: ${eventName}\n📒 Recorded in daybook\n\n_${payment.employeeName} has been notified._`;
}

// Complete income approval with event assignment
async function handleIncomeApprovalComplete(
  code: string,
  eventNameOrGeneral: string
): Promise<string> {
  const incomeSubmission = await storage.getIncomeSubmissionByCode(code.toUpperCase());
  
  if (!incomeSubmission) {
    return `❌ Income submission ${code.toUpperCase()} not found.`;
  }
  
  if (incomeSubmission.status !== 'pending') {
    return `⚠️ Income ${code.toUpperCase()} was already ${incomeSubmission.status}.`;
  }
  
  // Determine event assignment
  const rawEventName = eventNameOrGeneral?.trim() || '';
  const isGeneralIncome = !rawEventName || rawEventName.toLowerCase() === 'general';
  const eventName = isGeneralIncome ? 'General' : rawEventName;
  
  // Try to find event if specified
  let eventId: string | null = null;
  if (!isGeneralIncome && eventName.length >= 2) {
    const events = await storage.getAllEvents();
    const matchingEvent = events.find(e => 
      e.customer?.toLowerCase().includes(eventName.toLowerCase()) ||
      e.venue?.toLowerCase().includes(eventName.toLowerCase())
    );
    if (matchingEvent) {
      eventId = matchingEvent.id;
    }
  }
  
  // Create daybook entry as income
  const today = new Date().toISOString().split('T')[0];
  const category = incomeSubmission.type === 'bank_transfer' ? 'Bank Transfer' : 'Client Payment';
  const daybookEntry = await storage.createDaybookEntry({
    date: today,
    type: 'income',
    amount: incomeSubmission.amount,
    category,
    description: `${incomeSubmission.description} (via ${incomeSubmission.employeeName})`,
    eventId,
    eventName: isGeneralIncome ? null : eventName,
  });
  
  // Update income submission as approved
  await storage.updateIncomeSubmission(incomeSubmission.id, {
    status: 'approved',
    eventId,
    eventName: isGeneralIncome ? 'General' : eventName,
    daybookEntryId: daybookEntry.id,
    approvedAt: new Date(),
  });
  
  // Notify employee
  const notifyMessage = `🎉 *Income Approved!*\n\n✅ Your submission *${incomeSubmission.requestCode}* has been approved!\n\n💰 Amount: ₹${parseFloat(incomeSubmission.amount).toLocaleString('en-IN')}\n📋 Recorded under: ${isGeneralIncome ? 'General Income' : eventName}\n\n_Thank you!_ 🌳`;
  await sendWhatsAppMessage(incomeSubmission.employeePhone, notifyMessage);
  
  return `✅ *Income Recorded* - ${incomeSubmission.requestCode}\n\n💰 ₹${parseFloat(incomeSubmission.amount).toLocaleString('en-IN')}\n📝 ${incomeSubmission.description}\n📋 Added to: ${isGeneralIncome ? 'General Income' : eventName}\n\n_Employee notified & Daybook updated!_`;
}

// Reject income submission
async function handleIncomeReject(
  code: string,
  reason?: string
): Promise<string> {
  const incomeSubmission = await storage.getIncomeSubmissionByCode(code.toUpperCase());
  
  if (!incomeSubmission) {
    return `❌ Income submission ${code.toUpperCase()} not found.`;
  }
  
  if (incomeSubmission.status !== 'pending') {
    return `⚠️ Income ${code.toUpperCase()} was already ${incomeSubmission.status}.`;
  }
  
  const rejectReason = reason?.trim() || 'Not approved';
  
  await storage.updateIncomeSubmission(incomeSubmission.id, {
    status: 'rejected',
    rejectionReason: rejectReason,
  });
  
  // Notify employee
  const notifyMessage = `ℹ️ *Income Submission Update*\n\nYour submission *${incomeSubmission.requestCode}* was not approved.\n\n*Reason:* ${rejectReason}\n\n_Please contact management if you have questions._`;
  await sendWhatsAppMessage(incomeSubmission.employeePhone, notifyMessage);
  
  return `❌ *Rejected* - ${incomeSubmission.requestCode}\n*Reason:* ${rejectReason}\n\n_Employee notified._`;
}
