import Twilio from 'twilio';
import { storage } from './storage';
import type { Employee, WhatsappMessageJob, InsertWhatsappMessageLog } from '@shared/schema';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;
// Content Template SIDs for business-initiated messages (when customer hasn't messaged in 24h)
const documentTemplateSid = process.env.TWILIO_WHATSAPP_DOCUMENT_TEMPLATE_SID;
const textTemplateSid = process.env.TWILIO_WHATSAPP_TEXT_TEMPLATE_SID;
const otpTemplateSid = process.env.TWILIO_WHATSAPP_OTP_TEMPLATE_SID;
const plannerAssignedTemplateSid = process.env.TWILIO_WHATSAPP_PLANNER_ASSIGNED_TEMPLATE_SID;
const portalWelcomeTemplateSid = process.env.TWILIO_WHATSAPP_PORTAL_WELCOME_TEMPLATE_SID;
const notificationTemplateSid = process.env.TWILIO_WHATSAPP_NOTIFICATION_TEMPLATE_SID;
const rsvpTemplateSid = process.env.TWILIO_WHATSAPP_RSVP_TEMPLATE_SID;

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
  message: string,
  recipientName?: string
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
    console.error('[WhatsApp] Full error details:', error.code, error.moreInfo);
    
    // Check for 24-hour window error - try template fallback
    const is24HourError = error.code === 63016 || 
                          error.code === 63032 || 
                          error.message?.includes('outside the allowed window') || 
                          error.message?.includes('template') ||
                          error.message?.includes('Session message');
    
    if (is24HourError && notificationTemplateSid) {
      console.log('[WhatsApp] 24-hour window expired, trying notification template...');
      
      // Extract name from message or use provided name
      const name = recipientName || extractNameFromMessage(message) || 'there';
      // Truncate message to fit template (WhatsApp templates have limits)
      const truncatedMessage = message.length > 900 ? message.substring(0, 897) + '...' : message;
      
      const templateResult = await sendWhatsAppTemplateMessage(
        to,
        notificationTemplateSid,
        {
          '1': name,
          '2': truncatedMessage
        }
      );
      
      if (templateResult.success) {
        console.log('[WhatsApp] Template fallback successful');
        return templateResult;
      }
      
      console.error('[WhatsApp] Template fallback also failed:', templateResult.error);
    }
    
    if (is24HourError) {
      return { 
        success: false, 
        error: notificationTemplateSid 
          ? 'Failed to send message via template. The template might not be approved yet.'
          : 'WhatsApp requires an approved template for business-initiated messages. Please configure TWILIO_WHATSAPP_NOTIFICATION_TEMPLATE_SID.'
      };
    }
    
    return { success: false, error: error.message };
  }
}

// Helper to extract name from message content
function extractNameFromMessage(message: string): string | null {
  // Look for common patterns like "Hi Name," or "Hello Name!" or "Dear Name,"
  const patterns = [
    /(?:Hi|Hello|Dear|Hey)\s+([A-Za-z]+)[\s,!]/i,
    /^\*?([A-Za-z]+)\*?,?\s/,
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

// Send WhatsApp message using Content Template (for business-initiated messages)
export async function sendWhatsAppTemplateMessage(
  to: string,
  contentSid: string,
  contentVariables?: Record<string, string>,
  mediaUrl?: string
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
    
    console.log('[WhatsApp] Sending template message:', { from: formattedFrom, to: formattedTo, contentSid });
    
    const messageParams: any = {
      from: formattedFrom,
      to: formattedTo,
      contentSid: contentSid,
    };
    
    // For twilio/media templates, the media URL is passed via contentVariables
    // The template should have a {{1}} variable that receives the media URL
    const finalVariables: Record<string, string> = { ...contentVariables };
    if (mediaUrl) {
      // Common convention: variable 1 is media URL for document templates
      finalVariables['1'] = mediaUrl;
    }
    
    if (Object.keys(finalVariables).length > 0) {
      messageParams.contentVariables = JSON.stringify(finalVariables);
    }
    
    console.log('[WhatsApp] Template params:', JSON.stringify(messageParams, null, 2));
    
    const response = await client.messages.create(messageParams);

    console.log('[WhatsApp] Template message sent successfully:', response.sid);
    return { success: true, messageId: response.sid };
  } catch (error: any) {
    console.error('[WhatsApp] Template send error:', error.message);
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

  const formattedTo = formatPhoneForWhatsApp(to);
  const cleanFromNumber = fromNumber.replace(/^whatsapp:/i, '');
  const formattedFrom = `whatsapp:${cleanFromNumber}`;

  try {
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
    console.error('[WhatsApp] Full error details:', error.code, error.moreInfo);
    
    // Check for 24-hour window error - try template if configured
    const is24HourError = error.code === 63016 || 
                          error.code === 63032 ||
                          error.message?.includes('outside the allowed window') || 
                          error.message?.includes('template') ||
                          error.message?.includes('Session message');
    
    if (is24HourError && documentTemplateSid) {
      console.log('[WhatsApp] 24-hour window expired, trying template message...');
      
      // Try sending via template
      const templateResult = await sendWhatsAppTemplateMessage(
        to,
        documentTemplateSid,
        { '1': caption || 'Document attached' },
        mediaUrl
      );
      
      if (templateResult.success) {
        return templateResult;
      }
      
      console.error('[WhatsApp] Template fallback also failed:', templateResult.error);
    }
    
    if (is24HourError) {
      return { 
        success: false, 
        error: documentTemplateSid 
          ? 'Failed to send message. The template might not be approved yet, or try Email instead.'
          : 'This customer has not messaged Oaksy in the last 24 hours. Set up a WhatsApp Content Template in Twilio, or use Email instead.'
      };
    }
    
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

// Customer notification functions using approved templates

export async function sendPlannerAssignedNotification(
  customerPhone: string,
  customerName: string,
  plannerName: string,
  eventDate: string,
  venue: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!plannerAssignedTemplateSid) {
    console.log('[WhatsApp] Planner assigned template not configured - trying freeform message');
    const fallbackMessage = `🎉 *Great News from Oakstreet Events!*\n\n` +
      `Hi ${customerName},\n\n` +
      `We've assigned *${plannerName}* as your dedicated Wedding Planner!\n\n` +
      `${plannerName} will contact you shortly to discuss your event requirements.\n\n` +
      `We're excited to help create your perfect celebration!\n\n` +
      `— Team Oakstreet Events`;
    return sendWhatsAppMessage(customerPhone, fallbackMessage);
  }
  
  return sendWhatsAppTemplateMessage(
    customerPhone,
    plannerAssignedTemplateSid,
    {
      '1': customerName,
      '2': plannerName,
      '3': eventDate || 'To be confirmed',
      '4': venue || 'To be confirmed'
    }
  );
}

export async function sendOTPNotification(
  customerPhone: string,
  otpCode: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!otpTemplateSid) {
    console.log('[WhatsApp] OTP template not configured - trying freeform message');
    const fallbackMessage = `Your Oakstreet Events verification code is: *${otpCode}*\n\nThis code expires in 10 minutes.`;
    return sendWhatsAppMessage(customerPhone, fallbackMessage);
  }
  
  return sendWhatsAppTemplateMessage(
    customerPhone,
    otpTemplateSid,
    { '1': otpCode }
  );
}

export async function sendPortalWelcomeNotification(
  customerPhone: string,
  customerName: string,
  portalUrl: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!portalWelcomeTemplateSid) {
    console.log('[WhatsApp] Portal welcome template not configured - trying freeform message');
    const fallbackMessage = `Welcome to Oakstreet Events, ${customerName}! 🎉\n\n` +
      `Your personal client portal is ready:\n${portalUrl}\n\n` +
      `Use this portal to view estimates, track your event planning, and access important documents.\n\n` +
      `— Team Oakstreet Events`;
    return sendWhatsAppMessage(customerPhone, fallbackMessage);
  }
  
  return sendWhatsAppTemplateMessage(
    customerPhone,
    portalWelcomeTemplateSid,
    {
      '1': customerName,
      '2': portalUrl
    }
  );
}

export async function sendDocumentSharedNotification(
  customerPhone: string,
  customerName: string,
  documentType: string,
  eventType: string,
  eventDate: string,
  portalUrl: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!documentTemplateSid) {
    console.log('[WhatsApp] Document template not configured - trying freeform message');
    const fallbackMessage = `Hello ${customerName}! 📋\n\n` +
      `We've prepared your ${documentType} for review.\n\n` +
      `*Event*: ${eventType}\n*Date*: ${eventDate}\n\n` +
      `Please visit your Client Portal to view and approve:\n${portalUrl}\n\n` +
      `— Team Oakstreet Events`;
    return sendWhatsAppMessage(customerPhone, fallbackMessage);
  }
  
  return sendWhatsAppTemplateMessage(
    customerPhone,
    documentTemplateSid,
    {
      '1': customerName,
      '2': documentType,
      '3': eventType,
      '4': eventDate || 'To be confirmed',
      '5': portalUrl
    }
  );
}

const recentNotifications: Map<string, number> = new Map();
const NOTIFICATION_COOLDOWN_MS = 5 * 60 * 1000;

function cleanupOldNotifications() {
  const now = Date.now();
  for (const [key, timestamp] of recentNotifications.entries()) {
    if (now - timestamp > NOTIFICATION_COOLDOWN_MS) {
      recentNotifications.delete(key);
    }
  }
}

export async function sendGeneralNotification(
  recipientPhone: string,
  recipientName: string,
  messageContent: string,
  source?: string,
  entityId?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const sourceLabel = source || 'unknown';
  console.log(`[WhatsApp Notification] [Source: ${sourceLabel}] [Entity: ${entityId || 'none'}] Sending to ${recipientPhone} (${recipientName})`);
  
  cleanupOldNotifications();
  
  const NEW_LEAD_SOURCES = ['portal_lead_assignment', 'oaksy_chat_lead_creation', 'whatsapp_lead_submission', 'sales_deal_creation', 'event_booked'];
  if (source && NEW_LEAD_SOURCES.includes(source)) {
    const dedupeKey = entityId 
      ? `${recipientPhone}:new_lead:${entityId}` 
      : `${recipientPhone}:new_lead`;
    const lastSent = recentNotifications.get(dedupeKey);
    if (lastSent && Date.now() - lastSent < NOTIFICATION_COOLDOWN_MS) {
      console.log(`[WhatsApp Notification] SKIPPED duplicate new_lead to ${recipientPhone} (sent ${Math.round((Date.now() - lastSent) / 1000)}s ago, source: ${sourceLabel}, entity: ${entityId || 'none'})`);
      return { success: true, messageId: 'deduplicated' };
    }
    recentNotifications.set(dedupeKey, Date.now());
  }
  
  console.log(`[WhatsApp Notification] Template SID configured: ${!!notificationTemplateSid}`);
  
  // Always try to use template first for reliable delivery
  if (notificationTemplateSid) {
    // Sanitize content: remove problematic characters and truncate
    // Replace newlines with spaces, remove control characters
    const sanitizedMessage = messageContent
      .replace(/[\r\n]+/g, ' ')  // Replace newlines with space
      .replace(/[\x00-\x1F\x7F]/g, '')  // Remove control characters
      .trim();
    const sanitizedName = recipientName
      .replace(/[\r\n]+/g, ' ')
      .replace(/[\x00-\x1F\x7F]/g, '')
      .trim();
    
    // Truncate to fit template variable limits (Twilio limit ~1024 chars, but safer at 800)
    const truncatedMessage = sanitizedMessage.length > 800 ? sanitizedMessage.substring(0, 797) + '...' : sanitizedMessage;
    const truncatedName = sanitizedName.length > 50 ? sanitizedName.substring(0, 47) + '...' : sanitizedName;
    
    console.log(`[WhatsApp Notification] Sending template message to ${recipientPhone}`);
    console.log(`[WhatsApp Notification] Variables: name="${truncatedName.substring(0, 30)}...", msg length=${truncatedMessage.length}`);
    const result = await sendWhatsAppTemplateMessage(
      recipientPhone,
      notificationTemplateSid,
      {
        '1': truncatedName,
        '2': truncatedMessage
      }
    );
    
    if (result.success) {
      console.log(`[WhatsApp Notification] SUCCESS - Message ID: ${result.messageId}`);
      return result;
    }
    
    console.log('[WhatsApp Notification] Template message FAILED:', result.error);
    console.log('[WhatsApp Notification] Trying freeform as fallback...');
  } else {
    console.log('[WhatsApp Notification] Template not configured - trying freeform message');
  }
  
  // Fallback to freeform (will work within 24hr window, or use auto-template fallback)
  const result = await sendWhatsAppMessage(recipientPhone, messageContent, recipientName);
  console.log(`[WhatsApp Notification] Freeform result: ${result.success ? 'SUCCESS' : 'FAILED'} - ${result.error || result.messageId}`);
  return result;
}

export async function sendRsvpWhatsApp(
  recipientPhone: string,
  guestName: string,
  eventTitle: string,
  rsvpLink: string,
  eventId?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  console.log(`[WhatsApp RSVP] Sending invite to ${recipientPhone} (${guestName}) for "${eventTitle}" with link ${rsvpLink}`);

  const fallbackMessage = `Dear ${guestName}, Kindly check your personalized RSVP link for ${eventTitle}. ${rsvpLink} We look forward to your response. - Oakstreet Events`;

  if (rsvpTemplateSid) {
    console.log('[WhatsApp RSVP] Using approved RSVP template');
    const result = await sendWhatsAppTemplateMessage(
      recipientPhone,
      rsvpTemplateSid,
      {
        '1': guestName.substring(0, 50),
        '2': eventTitle.substring(0, 100),
        '3': rsvpLink.substring(0, 500),
      }
    );
    if (result.success) {
      console.log(`[WhatsApp RSVP] Template invite SUCCESS - ${result.messageId}`);
      return result;
    }
    console.log(`[WhatsApp RSVP] Template FAILED: ${result.error}, trying freeform...`);
  }

  return sendGeneralNotification(recipientPhone, guestName, fallbackMessage, 'rsvp_invite', eventId);
}

export async function sendRsvpReminderWhatsApp(
  recipientPhone: string,
  guestName: string,
  eventTitle: string,
  rsvpLink: string,
  eventId?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return sendRsvpWhatsApp(recipientPhone, guestName, eventTitle, rsvpLink, eventId);
}

// Helper to check if customer templates are configured
export function hasCustomerTemplatesConfigured(): boolean {
  return !!(plannerAssignedTemplateSid || portalWelcomeTemplateSid || documentTemplateSid || notificationTemplateSid || rsvpTemplateSid);
}

// Get configured template status for debugging
export function getTemplateStatus(): Record<string, boolean> {
  return {
    otp: !!otpTemplateSid,
    plannerAssigned: !!plannerAssignedTemplateSid,
    portalWelcome: !!portalWelcomeTemplateSid,
    document: !!documentTemplateSid,
    notification: !!notificationTemplateSid,
    rsvp: !!rsvpTemplateSid
  };
}
