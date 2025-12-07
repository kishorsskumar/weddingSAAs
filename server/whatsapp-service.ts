import Twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER;

let client: Twilio.Twilio | null = null;

function getClient(): Twilio.Twilio | null {
  if (!accountSid || !authToken) {
    console.warn('Twilio credentials not configured');
    return null;
  }
  if (!client) {
    client = Twilio(accountSid, authToken);
  }
  return client;
}

function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\s+/g, '').replace(/-/g, '');
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

export interface WhatsAppMessage {
  to: string;
  message: string;
}

export interface WhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<WhatsAppResult> {
  const twilioClient = getClient();
  
  if (!twilioClient) {
    return {
      success: false,
      error: 'Twilio not configured. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.',
    };
  }

  if (!twilioWhatsAppNumber) {
    return {
      success: false,
      error: 'Twilio WhatsApp number not configured. Please set TWILIO_WHATSAPP_NUMBER.',
    };
  }

  try {
    const formattedTo = formatPhoneNumber(to);
    const fromNumber = twilioWhatsAppNumber.startsWith('whatsapp:') 
      ? twilioWhatsAppNumber 
      : `whatsapp:${twilioWhatsAppNumber}`;

    const result = await twilioClient.messages.create({
      body: message,
      from: fromNumber,
      to: formattedTo,
    });

    console.log(`[WhatsApp] Message sent to ${to}, SID: ${result.sid}`);
    
    return {
      success: true,
      messageId: result.sid,
    };
  } catch (error: any) {
    console.error('[WhatsApp] Send error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to send WhatsApp message',
    };
  }
}

export async function sendNotificationViaWhatsApp(
  phoneNumber: string,
  title: string,
  message: string,
  priority?: string
): Promise<WhatsAppResult> {
  const priorityEmoji = priority === 'urgent' ? '🚨' : priority === 'high' ? '⚠️' : 'ℹ️';
  const formattedMessage = `${priorityEmoji} *${title}*\n\n${message}\n\n_Oak Event Management_`;
  
  return sendWhatsAppMessage(phoneNumber, formattedMessage);
}

export function isWhatsAppConfigured(): boolean {
  return !!(accountSid && authToken && twilioWhatsAppNumber);
}
