import Twilio from 'twilio';
import { storage } from './storage';
import type { Employee, WhatsappMessageJob, InsertWhatsappMessageLog } from '@shared/schema';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;

let twilioClient: Twilio.Twilio | null = null;

function getTwilioClient(): Twilio.Twilio | null {
  if (!accountSid || !authToken) {
    console.log('[WhatsApp] Twilio credentials not configured');
    return null;
  }
  if (!twilioClient) {
    twilioClient = Twilio(accountSid, authToken);
  }
  return twilioClient;
}

export function isWhatsAppConfigured(): boolean {
  return !!(accountSid && authToken && fromNumber);
}

export function getWhatsAppFromNumber(): string {
  return fromNumber || '';
}

function formatPhoneForWhatsApp(phone: string): string {
  let cleaned = phone.replace(/[^0-9+]/g, '');
  if (!cleaned.startsWith('+')) {
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      cleaned = '+' + cleaned;
    } else if (cleaned.length === 10) {
      cleaned = '+91' + cleaned;
    } else {
      cleaned = '+' + cleaned;
    }
  }
  return `whatsapp:${cleaned}`;
}

function replaceVariables(template: string, variables: Record<string, string>, employee: Employee): string {
  let result = template;
  result = result.replace(/\{\{employee_name\}\}/g, employee.name || '');
  result = result.replace(/\{\{employee_code\}\}/g, employee.employeeId || '');
  result = result.replace(/\{\{department\}\}/g, employee.department || '');
  result = result.replace(/\{\{designation\}\}/g, employee.designation || '');
  
  if (variables) {
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, value);
    }
  }
  
  return result;
}

export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const client = getTwilioClient();
  if (!client) {
    return { success: false, error: 'Twilio not configured' };
  }
  if (!fromNumber) {
    return { success: false, error: 'WhatsApp from number not configured' };
  }

  try {
    const formattedTo = formatPhoneForWhatsApp(to);
    // Ensure fromNumber doesn't already have whatsapp: prefix
    const cleanFromNumber = fromNumber.replace(/^whatsapp:/i, '');
    const formattedFrom = `whatsapp:${cleanFromNumber}`;
    
    console.log('[WhatsApp] Sending message:', { from: formattedFrom, to: formattedTo });
    
    const response = await client.messages.create({
      body: message,
      from: formattedFrom,
      to: formattedTo,
    });

    console.log('[WhatsApp] Message sent successfully:', response.sid);
    return { success: true, messageId: response.sid };
  } catch (error: any) {
    console.error('[WhatsApp] Send error:', error.message);
    console.error('[WhatsApp] Full error:', JSON.stringify(error, null, 2));
    return { success: false, error: error.message };
  }
}

export async function sendWhatsAppMediaMessage(
  to: string,
  mediaUrl: string,
  caption?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const client = getTwilioClient();
  if (!client) {
    return { success: false, error: 'Twilio not configured' };
  }
  if (!fromNumber) {
    return { success: false, error: 'WhatsApp from number not configured' };
  }

  try {
    const formattedTo = formatPhoneForWhatsApp(to);
    const cleanFromNumber = fromNumber.replace(/^whatsapp:/i, '');
    const formattedFrom = `whatsapp:${cleanFromNumber}`;
    
    console.log('[WhatsApp] Sending media message:', { from: formattedFrom, to: formattedTo, mediaUrl });
    
    const messageParams: any = {
      from: formattedFrom,
      to: formattedTo,
      mediaUrl: [mediaUrl],
    };
    
    if (caption) {
      messageParams.body = caption;
    }
    
    const response = await client.messages.create(messageParams);

    console.log('[WhatsApp] Media message sent successfully:', response.sid);
    return { success: true, messageId: response.sid };
  } catch (error: any) {
    console.error('[WhatsApp] Media send error:', error.message);
    return { success: false, error: error.message };
  }
}

export async function processWhatsAppJob(jobId: string): Promise<{
  success: boolean;
  successCount: number;
  failureCount: number;
  error?: string;
}> {
  const job = await storage.getWhatsappJob(jobId);
  if (!job) {
    return { success: false, successCount: 0, failureCount: 0, error: 'Job not found' };
  }

  if (job.status !== 'pending') {
    return { success: false, successCount: 0, failureCount: 0, error: 'Job is not pending' };
  }

  await storage.updateWhatsappJob(jobId, { status: 'processing' });

  let targetEmployees: Employee[] = [];

  try {
    if (job.targetMode === 'all') {
      const allOptedIn = await storage.getEmployeesWithWhatsappOptIn();
      targetEmployees = allOptedIn.filter(e => e.phone);
    } else if (job.targetMode === 'department' && job.targetDepartments) {
      const allOptedIn = await storage.getEmployeesWithWhatsappOptIn();
      targetEmployees = allOptedIn.filter(
        e => e.phone && e.department && job.targetDepartments!.includes(e.department)
      );
    } else if (job.targetMode === 'selected' && job.targetEmployeeIds) {
      const allEmployees = await storage.getAllEmployees();
      targetEmployees = allEmployees.filter(
        e => e.phone && e.whatsappOptIn && job.targetEmployeeIds!.includes(e.id)
      );
    }

    let messageTemplate = job.customMessage || '';
    if (job.templateId) {
      const template = await storage.getWhatsappTemplate(job.templateId);
      if (template) {
        messageTemplate = template.body;
      }
    }

    if (!messageTemplate) {
      await storage.updateWhatsappJob(jobId, { 
        status: 'failed', 
        errorMessage: 'No message content',
      });
      return { success: false, successCount: 0, failureCount: 0, error: 'No message content' };
    }

    await storage.updateWhatsappJob(jobId, { totalRecipients: targetEmployees.length });

    let successCount = 0;
    let failureCount = 0;
    const variableValues = (job.variableValues as Record<string, string>) || {};

    for (const employee of targetEmployees) {
      const personalizedMessage = replaceVariables(messageTemplate, variableValues, employee);
      
      const logEntry: InsertWhatsappMessageLog = {
        jobId: job.id,
        employeeId: employee.id,
        phoneNumber: employee.phone!,
        messageContent: personalizedMessage,
        status: 'pending',
      };
      const log = await storage.createWhatsappLog(logEntry);

      const result = await sendWhatsAppMessage(employee.phone!, personalizedMessage);

      if (result.success) {
        successCount++;
        await storage.updateWhatsappLog(log.id, {
          status: 'sent',
          providerMessageId: result.messageId,
          sentAt: new Date(),
        });
      } else {
        failureCount++;
        await storage.updateWhatsappLog(log.id, {
          status: 'failed',
          errorMessage: result.error,
          failedAt: new Date(),
        });
      }
    }

    const finalStatus = failureCount === 0 ? 'completed' : (successCount === 0 ? 'failed' : 'completed');
    await storage.updateWhatsappJob(jobId, {
      status: finalStatus,
      successCount,
      failureCount,
    });

    return { success: true, successCount, failureCount };
  } catch (error: any) {
    await storage.updateWhatsappJob(jobId, {
      status: 'failed',
      errorMessage: error.message,
    });
    return { success: false, successCount: 0, failureCount: 0, error: error.message };
  }
}

export async function sendQuickWhatsAppMessage(
  employeeIds: string[],
  message: string,
  requestedBy: string
): Promise<{ jobId: string; success: boolean; error?: string }> {
  try {
    const job = await storage.createWhatsappJob({
      customMessage: message,
      targetMode: 'selected',
      targetEmployeeIds: employeeIds,
      status: 'pending',
      requestedBy,
    });

    const result = await processWhatsAppJob(job.id);
    return { jobId: job.id, success: result.success, error: result.error };
  } catch (error: any) {
    return { jobId: '', success: false, error: error.message };
  }
}
