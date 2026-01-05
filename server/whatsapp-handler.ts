import { storage } from './storage';
import { sendWhatsAppMessage, isWhatsAppConfigured } from './whatsapp-service';
import type { WhatsappConversation, InsertExpenseReimbursement, InsertLeaveRequest } from '@shared/schema';

interface PendingData {
  purpose?: string;
  amount?: string;
  mediaUrl?: string;
  startDate?: string;
  endDate?: string;
  reason?: string;
}

const MENU_MESSAGE = `👋 Welcome to Oakstreet Events!

Please select an option:
1️⃣ Submit Expense
2️⃣ Apply for Leave
3️⃣ Check My Status

Reply with the number (1, 2, or 3)`;

const EXPENSE_PURPOSE_MESSAGE = `📝 *Submit Expense*

Please describe the purpose of this expense.
Example: "Taxi to venue for client meeting"`;

const EXPENSE_AMOUNT_MESSAGE = `💰 Got it! Now please enter the expense amount in ₹.
Example: "1500" or "2500.50"`;

const EXPENSE_PHOTO_MESSAGE = `📸 Great! Now please send a photo of the invoice/receipt.

Just attach the image to your message.`;

const LEAVE_START_MESSAGE = `📅 *Apply for Leave*

Please enter your leave start date.
Format: DD/MM/YYYY
Example: "15/01/2026"`;

const LEAVE_END_MESSAGE = `📅 Now enter your leave end date.
Format: DD/MM/YYYY
Example: "17/01/2026"`;

const LEAVE_REASON_MESSAGE = `✍️ Please provide a reason for your leave.
Example: "Family function" or "Medical appointment"`;

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
        currentState: 'expense_purpose',
        currentDepartment: 'accounts',
        pendingData: {},
      });
      return EXPENSE_PURPOSE_MESSAGE;
    } else if (messageText === '2' || messageText.includes('leave')) {
      await storage.updateWhatsappConversation(conversation.id, {
        currentState: 'leave_start',
        currentDepartment: 'hr',
        pendingData: {},
      });
      return LEAVE_START_MESSAGE;
    } else if (messageText === '3' || messageText.includes('status')) {
      return await getEmployeeStatus(employee.id, employee.name);
    } else {
      return `❓ I didn't understand that. Please reply with:\n1 for Expense\n2 for Leave\n3 for Status\n\nOr type "menu" to see options again.`;
    }
  }

  if (conversation.currentState === 'expense_purpose') {
    await storage.updateWhatsappConversation(conversation.id, {
      currentState: 'expense_amount',
      pendingData: { ...pendingData, purpose: body.trim() },
    });
    return EXPENSE_AMOUNT_MESSAGE;
  }

  if (conversation.currentState === 'expense_amount') {
    const amount = parseFloat(body.replace(/[^0-9.]/g, ''));
    if (isNaN(amount) || amount <= 0) {
      return `❌ Please enter a valid amount. Example: "1500" or "2500.50"`;
    }
    await storage.updateWhatsappConversation(conversation.id, {
      currentState: 'expense_photo',
      pendingData: { ...pendingData, amount: amount.toString() },
    });
    return EXPENSE_PHOTO_MESSAGE;
  }

  if (conversation.currentState === 'expense_photo') {
    if (!mediaUrl) {
      return `📸 Please attach a photo of your invoice/receipt. Just send an image with this message.`;
    }
    
    const finalData = { ...pendingData, mediaUrl };
    
    const expenseRequest = await createExpenseRequest(
      employee.id,
      employee.name,
      finalData.purpose || 'Expense',
      parseFloat(finalData.amount || '0'),
      mediaUrl
    );

    await storage.updateWhatsappConversation(conversation.id, {
      currentState: 'idle',
      pendingData: null,
    });

    await notifySuperadminOfExpense(expenseRequest.approvalCode, employee.name, finalData.purpose || 'Expense', finalData.amount || '0', mediaUrl);

    return `✅ *Expense Submitted Successfully!*

📝 Purpose: ${finalData.purpose}
💰 Amount: ₹${finalData.amount}
📸 Receipt: Attached

Your request has been sent to management for approval. You'll receive a notification once it's processed.

Reference: ${expenseRequest.approvalCode}

Type "menu" for more options.`;
  }

  if (conversation.currentState === 'leave_start') {
    const startDate = parseDate(body.trim());
    if (!startDate) {
      return `❌ Invalid date format. Please use DD/MM/YYYY format.\nExample: "15/01/2026"`;
    }
    await storage.updateWhatsappConversation(conversation.id, {
      currentState: 'leave_end',
      pendingData: { ...pendingData, startDate: startDate.toISOString().split('T')[0] },
    });
    return LEAVE_END_MESSAGE;
  }

  if (conversation.currentState === 'leave_end') {
    const endDate = parseDate(body.trim());
    if (!endDate) {
      return `❌ Invalid date format. Please use DD/MM/YYYY format.\nExample: "17/01/2026"`;
    }
    const startDate = new Date(pendingData.startDate!);
    if (endDate < startDate) {
      return `❌ End date cannot be before start date. Please enter a valid end date.`;
    }
    await storage.updateWhatsappConversation(conversation.id, {
      currentState: 'leave_reason',
      pendingData: { ...pendingData, endDate: endDate.toISOString().split('T')[0] },
    });
    return LEAVE_REASON_MESSAGE;
  }

  if (conversation.currentState === 'leave_reason') {
    const finalData = { ...pendingData, reason: body.trim() };
    
    const leaveRequest = await createLeaveRequest(
      employee.id,
      employee.name,
      finalData.startDate!,
      finalData.endDate!,
      finalData.reason!
    );

    await storage.updateWhatsappConversation(conversation.id, {
      currentState: 'idle',
      pendingData: null,
    });

    const startFormatted = formatDateForDisplay(finalData.startDate!);
    const endFormatted = formatDateForDisplay(finalData.endDate!);
    const days = calculateDays(finalData.startDate!, finalData.endDate!);

    await notifySuperadminOfLeave(leaveRequest.approvalCode, employee.name, startFormatted, endFormatted, days, finalData.reason!);

    return `✅ *Leave Request Submitted!*

📅 From: ${startFormatted}
📅 To: ${endFormatted}
📊 Days: ${days}
📝 Reason: ${finalData.reason}

Your request has been sent for approval. You'll be notified once it's processed.

Reference: ${leaveRequest.approvalCode}

Type "menu" for more options.`;
  }

  return MENU_MESSAGE;
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
