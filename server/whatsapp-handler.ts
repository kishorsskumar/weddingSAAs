import { storage } from './storage';
import { sendWhatsAppMessage, isWhatsAppConfigured } from './whatsapp-service';
import type { WhatsappConversation, InsertExpenseReimbursement, InsertLeaveRequest } from '@shared/schema';
import { config } from '../shared/config';

interface PendingData {
  purpose?: string;
  amount?: string;
  mediaUrl?: string;
  startDate?: string;
  endDate?: string;
  reason?: string;
}

const MENU_MESSAGE = `🌳 *Welcome to ${config.company.name}!*
━━━━━━━━━━━━━━━━━━━━━

How can we help you today?

*1️⃣  Submit Expenses*
*2️⃣  Apply for Leave*
*3️⃣  Check my Status*

━━━━━━━━━━━━━━━━━━━━━
_Reply with 1, 2, or 3_`;

const EXPENSE_PROMPT_MESSAGE = `💰 *Submit Expense*
━━━━━━━━━━━━━━━━━━━━━

Please provide the following details in *one message*:

📝 *Purpose:* What was the expense for?
💵 *Amount:* How much in ₹?
📸 *Receipt:* Attach invoice/receipt photo

━━━━━━━━━━━━━━━━━━━━━
*Example:*
_Taxi to client venue - 1500_
(with receipt photo attached)

_Type "menu" to go back_`;

const LEAVE_PROMPT_MESSAGE = `📅 *Apply for Leave*
━━━━━━━━━━━━━━━━━━━━━

Please provide the following details in *one message*:

📆 *Start Date:* DD/MM/YYYY
📆 *End Date:* DD/MM/YYYY
📝 *Reason:* Why do you need leave?

━━━━━━━━━━━━━━━━━━━━━
*Example:*
_01/02/2026 - 03/02/2026 - Family function_

_Type "menu" to go back_`;

export async function handleIncomingWhatsAppMessage(
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
    return `❌ Sorry, we couldn't find your employee record. Please contact HR to ensure your phone number is registered in the system.`;
  }

  const messageText = body.trim().toLowerCase();
  const pendingData = (conversation.pendingData as PendingData) || {};

  if (messageText === 'hi' || messageText === 'hello' || messageText === 'menu' || messageText === '0' || conversation.currentState === 'idle') {
    await storage.updateWhatsappConversation(conversation.id, {
      currentState: 'menu',
      currentDepartment: null,
      pendingData: null,
    });
    return MENU_MESSAGE;
  }

  if (conversation.currentState === 'menu') {
    if (messageText === '1' || messageText.includes('expense')) {
      await storage.updateWhatsappConversation(conversation.id, {
        currentState: 'awaiting_expense',
        currentDepartment: 'accounts',
        pendingData: {},
      });
      return EXPENSE_PROMPT_MESSAGE;
    } else if (messageText === '2' || messageText.includes('leave')) {
      await storage.updateWhatsappConversation(conversation.id, {
        currentState: 'awaiting_leave',
        currentDepartment: 'hr',
        pendingData: {},
      });
      return LEAVE_PROMPT_MESSAGE;
    } else if (messageText === '3' || messageText.includes('status')) {
      return await getEmployeeStatus(employee.id, employee.name);
    } else {
      return `❓ _I didn't understand that._

Please reply with:
*1* - Submit Expenses
*2* - Apply for Leave
*3* - Check my Status

_Or type "menu" to see options again_`;
    }
  }

  // Handle single-message expense submission
  if (conversation.currentState === 'awaiting_expense') {
    // Check if user wants to go back
    if (messageText === 'menu' || messageText === '0') {
      await storage.updateWhatsappConversation(conversation.id, {
        currentState: 'menu',
        pendingData: null,
      });
      return MENU_MESSAGE;
    }

    // Must have a receipt photo attached
    if (!mediaUrl) {
      return `📸 *Receipt Required!*
━━━━━━━━━━━━━━━━━━━━━

Please send your expense details *with a receipt photo attached*.

*Example:*
_Taxi to venue - 1500_
(with receipt attached)

_Type "menu" to go back_`;
    }

    // Parse expense: "Purpose - Amount" or "Purpose Amount" format
    const expenseData = parseExpenseMessage(body.trim());
    
    if (!expenseData.purpose || !expenseData.amount) {
      return `❌ *Could not understand your expense*
━━━━━━━━━━━━━━━━━━━━━

Please send in this format:
_Purpose - Amount_

*Example:*
_Taxi to client venue - 1500_
(with receipt photo attached)

_Type "menu" to go back_`;
    }

    const expenseRequest = await createExpenseRequest(
      employee.id,
      employee.name,
      expenseData.purpose,
      expenseData.amount,
      mediaUrl
    );

    await storage.updateWhatsappConversation(conversation.id, {
      currentState: 'idle',
      pendingData: null,
    });

    await notifySuperadminOfExpense(expenseRequest.approvalCode, employee.name, expenseData.purpose, expenseData.amount.toString(), mediaUrl);

    return `✅ *Expense Submitted!*
━━━━━━━━━━━━━━━━━━━━━

📝 *Purpose:* ${expenseData.purpose}
💰 *Amount:* ₹${expenseData.amount.toLocaleString('en-IN')}
📸 *Receipt:* Attached
🔖 *Reference:* ${expenseRequest.approvalCode}

━━━━━━━━━━━━━━━━━━━━━
_Your request has been sent for approval. You'll be notified once processed._

_Type "menu" for more options_`;
  }

  // Handle single-message leave submission
  if (conversation.currentState === 'awaiting_leave') {
    // Check if user wants to go back
    if (messageText === 'menu' || messageText === '0') {
      await storage.updateWhatsappConversation(conversation.id, {
        currentState: 'menu',
        pendingData: null,
      });
      return MENU_MESSAGE;
    }

    // Parse leave: "DD/MM/YYYY - DD/MM/YYYY - Reason" format
    const leaveData = parseLeaveMessage(body.trim());
    
    if (!leaveData.startDate || !leaveData.endDate || !leaveData.reason) {
      return `❌ *Could not understand your leave request*
━━━━━━━━━━━━━━━━━━━━━

Please send in this format:
_Start Date - End Date - Reason_

*Example:*
_01/02/2026 - 03/02/2026 - Family function_

_Type "menu" to go back_`;
    }

    if (leaveData.endDate < leaveData.startDate) {
      return `❌ *End date cannot be before start date*

Please try again with valid dates.`;
    }

    const startDateStr = leaveData.startDate.toISOString().split('T')[0];
    const endDateStr = leaveData.endDate.toISOString().split('T')[0];

    const leaveRequest = await createLeaveRequest(
      employee.id,
      employee.name,
      startDateStr,
      endDateStr,
      leaveData.reason
    );

    await storage.updateWhatsappConversation(conversation.id, {
      currentState: 'idle',
      pendingData: null,
    });

    const startFormatted = formatDateForDisplay(startDateStr);
    const endFormatted = formatDateForDisplay(endDateStr);
    const days = calculateDays(startDateStr, endDateStr);

    await notifySuperadminOfLeave(leaveRequest.approvalCode, employee.name, startFormatted, endFormatted, days, leaveData.reason);

    return `✅ *Leave Request Submitted!*
━━━━━━━━━━━━━━━━━━━━━

📅 *From:* ${startFormatted}
📅 *To:* ${endFormatted}
📊 *Days:* ${days}
📝 *Reason:* ${leaveData.reason}
🔖 *Reference:* ${leaveRequest.approvalCode}

━━━━━━━━━━━━━━━━━━━━━
_Your request has been sent for approval. You'll be notified once processed._

_Type "menu" for more options_`;
  }

  return MENU_MESSAGE;
}

// Parse expense message: "Purpose - Amount" or "Purpose Amount"
function parseExpenseMessage(message: string): { purpose: string | null; amount: number | null } {
  // Try "Purpose - Amount" format first
  const dashMatch = message.match(/^(.+?)\s*[-–—]\s*(\d+(?:\.\d{1,2})?)$/);
  if (dashMatch) {
    return {
      purpose: dashMatch[1].trim(),
      amount: parseFloat(dashMatch[2])
    };
  }

  // Try "Purpose Amount" format (amount at end)
  const spaceMatch = message.match(/^(.+?)\s+(\d+(?:\.\d{1,2})?)$/);
  if (spaceMatch) {
    return {
      purpose: spaceMatch[1].trim(),
      amount: parseFloat(spaceMatch[2])
    };
  }

  // Try extracting any number as amount
  const numbers = message.match(/(\d+(?:\.\d{1,2})?)/g);
  if (numbers && numbers.length > 0) {
    const amount = parseFloat(numbers[numbers.length - 1]);
    const purpose = message.replace(numbers[numbers.length - 1], '').replace(/[-–—]/g, '').trim();
    if (purpose && amount > 0) {
      return { purpose, amount };
    }
  }

  return { purpose: null, amount: null };
}

// Parse leave message: "DD/MM/YYYY - DD/MM/YYYY - Reason"
function parseLeaveMessage(message: string): { startDate: Date | null; endDate: Date | null; reason: string | null } {
  // Match pattern: date - date - reason
  const parts = message.split(/\s*[-–—]\s*/);
  
  if (parts.length >= 3) {
    const startDate = parseDate(parts[0].trim());
    const endDate = parseDate(parts[1].trim());
    const reason = parts.slice(2).join(' - ').trim();
    
    if (startDate && endDate && reason) {
      return { startDate, endDate, reason };
    }
  }

  // Try to find two dates and remaining text
  const datePattern = /(\d{1,2}\/\d{1,2}\/\d{4})/g;
  const dates = message.match(datePattern);
  
  if (dates && dates.length >= 2) {
    const startDate = parseDate(dates[0]);
    const endDate = parseDate(dates[1]);
    let reason = message;
    dates.forEach(d => { reason = reason.replace(d, ''); });
    reason = reason.replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').trim();
    
    if (startDate && endDate && reason) {
      return { startDate, endDate, reason };
    }
  }

  return { startDate: null, endDate: null, reason: null };
}

export async function handleSuperadminApprovalResponse(
  fromNumber: string,
  body: string
): Promise<string | null> {
  const normalizedPhone = normalizePhoneNumber(fromNumber);
  const messageText = body.trim().toUpperCase();

  const codeMatch = messageText.match(/^(A|R)\s*(EXP\d+|LV\d+)/i) || messageText.match(/^(EXP\d+|LV\d+)\s*(A|R)/i);
  
  if (!codeMatch) {
    return null;
  }

  let action: 'A' | 'R';
  let code: string;
  
  if (codeMatch[1] === 'A' || codeMatch[1] === 'R') {
    action = codeMatch[1] as 'A' | 'R';
    code = codeMatch[2];
  } else {
    code = codeMatch[1];
    action = codeMatch[2] as 'A' | 'R';
  }

  const approval = await storage.getWhatsappPendingApprovalByCode(code);
  
  if (!approval) {
    return `❌ Approval code ${code} not found.`;
  }

  if (approval.status !== 'pending') {
    return `ℹ️ Request ${code} has already been ${approval.status}.`;
  }

  const isApproved = action === 'A';
  const status = isApproved ? 'approved' : 'rejected';

  await storage.updateWhatsappPendingApproval(approval.id, {
    status,
    respondedAt: new Date(),
  });

  if (approval.type === 'expense') {
    await storage.updateExpenseReimbursement(approval.requestId, {
      status,
      approvedAt: isApproved ? new Date() : undefined,
    });
  } else if (approval.type === 'leave') {
    await storage.updateLeaveRequest(approval.requestId, {
      status,
      approvedAt: isApproved ? new Date() : undefined,
    });
  }

  const employee = await storage.getEmployee(approval.employeeId);
  if (employee?.whatsappNumber || employee?.phone) {
    const employeePhone = employee.whatsappNumber || employee.phone!;
    const statusEmoji = isApproved ? '✅' : '❌';
    const statusText = isApproved ? 'APPROVED' : 'REJECTED';
    const requestType = approval.type === 'expense' ? 'Expense' : 'Leave';
    
    await sendWhatsAppMessage(
      employeePhone,
      `${statusEmoji} Your ${requestType} request (${code}) has been *${statusText}*!\n\n${approval.description}`
    );
  }

  return `✅ ${code} has been *${status.toUpperCase()}*. ${employee?.name || 'Employee'} has been notified.`;
}

async function createExpenseRequest(
  employeeId: string,
  employeeName: string,
  purpose: string,
  amount: number,
  mediaUrl: string
): Promise<{ approvalCode: string; requestId: string }> {
  const today = new Date().toISOString().split('T')[0];
  
  const expense = await storage.createExpenseReimbursement({
    employeeId,
    requestDate: today,
    expenseDate: today,
    category: 'other',
    description: purpose,
    amount: amount.toString(),
    voucherPath: mediaUrl,
    status: 'pending',
  });

  const approvalCode = await storage.generateApprovalCode('expense');
  const superadminPhone = await getSuperadminPhone();

  await storage.createWhatsappPendingApproval({
    approvalCode,
    type: 'expense',
    requestId: expense.id,
    employeeId,
    employeeName,
    description: `Expense: ${purpose} - ₹${amount}`,
    amount: amount.toString(),
    mediaUrl,
    status: 'pending',
    approverPhone: superadminPhone,
    sentAt: new Date(),
  });

  return { approvalCode, requestId: expense.id };
}

async function createLeaveRequest(
  employeeId: string,
  employeeName: string,
  startDate: string,
  endDate: string,
  reason: string
): Promise<{ approvalCode: string; requestId: string }> {
  const leave = await storage.createLeaveRequest({
    employeeId,
    startDate,
    endDate,
    leaveType: 'casual',
    reason,
    status: 'pending',
  });

  const approvalCode = await storage.generateApprovalCode('leave');
  const superadminPhone = await getSuperadminPhone();
  const days = calculateDays(startDate, endDate);

  await storage.createWhatsappPendingApproval({
    approvalCode,
    type: 'leave',
    requestId: leave.id,
    employeeId,
    employeeName,
    description: `Leave: ${formatDateForDisplay(startDate)} to ${formatDateForDisplay(endDate)} (${days} days) - ${reason}`,
    status: 'pending',
    approverPhone: superadminPhone,
    sentAt: new Date(),
  });

  return { approvalCode, requestId: leave.id };
}

async function notifySuperadminOfExpense(
  code: string,
  employeeName: string,
  purpose: string,
  amount: string,
  mediaUrl: string
): Promise<void> {
  const superadminPhone = await getSuperadminPhone();
  if (!superadminPhone) return;

  const message = `🧾 *New Expense Request*

👤 From: ${employeeName}
📝 Purpose: ${purpose}
💰 Amount: ₹${amount}

Reply:
*A ${code}* to Approve
*R ${code}* to Reject`;

  await sendWhatsAppMessage(superadminPhone, message);
}

async function notifySuperadminOfLeave(
  code: string,
  employeeName: string,
  startDate: string,
  endDate: string,
  days: number,
  reason: string
): Promise<void> {
  const superadminPhone = await getSuperadminPhone();
  if (!superadminPhone) return;

  const message = `📅 *New Leave Request*

👤 From: ${employeeName}
📆 Dates: ${startDate} to ${endDate}
📊 Days: ${days}
📝 Reason: ${reason}

Reply:
*A ${code}* to Approve
*R ${code}* to Reject`;

  await sendWhatsAppMessage(superadminPhone, message);
}

async function getEmployeeStatus(employeeId: string, employeeName: string): Promise<string> {
  const expenses = await storage.getExpenseReimbursements(employeeId);
  const leaves = await storage.getLeaveRequestsByEmployee(employeeId);
  
  const pendingExpenses = expenses.filter((e: { status: string }) => e.status === 'pending').length;
  const approvedExpenses = expenses.filter((e: { status: string }) => e.status === 'approved').length;
  const pendingLeaves = leaves.filter((l: { status: string }) => l.status === 'pending').length;
  const approvedLeaves = leaves.filter((l: { status: string }) => l.status === 'approved').length;

  return `📊 *Status for ${employeeName}*

💰 *Expenses:*
• Pending: ${pendingExpenses}
• Approved: ${approvedExpenses}

📅 *Leave Requests:*
• Pending: ${pendingLeaves}
• Approved: ${approvedLeaves}

Type "menu" for more options.`;
}

async function getSuperadminPhone(): Promise<string> {
  const users = await storage.getAllUsers();
  const superadmin = users.find(u => u.role === 'superadmin');
  if (superadmin) {
    const employee = await storage.getEmployeeByUserId(superadmin.id);
    return employee?.whatsappNumber || employee?.phone || '';
  }
  return '';
}

function normalizePhoneNumber(phone: string): string {
  return phone.replace(/^whatsapp:/i, '').replace(/[^0-9+]/g, '');
}

function parseDate(dateStr: string): Date | null {
  const parts = dateStr.split(/[\/\-\.]/);
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      const date = new Date(year, month, day);
      if (date.getDate() === day && date.getMonth() === month) {
        return date;
      }
    }
  }
  return null;
}

function formatDateForDisplay(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function calculateDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}
