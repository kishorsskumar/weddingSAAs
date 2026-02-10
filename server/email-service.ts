import { Resend } from 'resend';
import { storage } from './storage';

const DEFAULT_FROM_EMAIL = 'Atbott <noreply@atbottsolutions.com>';

async function getCredentials() {
  if (process.env.RESEND_API_KEY) {
    return { apiKey: process.env.RESEND_API_KEY, fromEmail: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL };
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('No Resend API key found');
  }

  const connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return { apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email || DEFAULT_FROM_EMAIL };
}

async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

export async function sendPasswordResetEmail(toEmail: string, resetToken: string, userName?: string) {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.REPLIT_DOMAINS 
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
        : 'http://localhost:5000';
    
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
    
    const result = await client.emails.send({
      from: fromEmail || 'noreply@resend.dev',
      to: toEmail,
      subject: 'Reset Your Password - AtBott Wedding SaaS',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #2FA4BC 0%, #2590a6 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">AtBott Wedding SaaS</h1>
          </div>
          <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
            <h2 style="color: #333; margin-top: 0;">Reset Your Password</h2>
            <p>Hi${userName ? ` ${userName}` : ''},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #2FA4BC; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Reset Password</a>
            </div>
            <p style="color: #666; font-size: 14px;">This link will expire in 1 hour for security reasons.</p>
            <p style="color: #666; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
            <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">
            <p style="color: #999; font-size: 12px; margin: 0;">AtBott Wedding SaaS - Your Complete Event Management Platform</p>
          </div>
        </body>
        </html>
      `
    });

    console.log('[Email] Password reset email sent to:', toEmail, 'Result:', result);
    return { success: true, result };
  } catch (error) {
    console.error('[Email] Failed to send password reset email:', error);
    throw error;
  }
}

export async function sendDemoConfirmationEmail(toEmail: string, name: string, preferredDate?: string | null, preferredTime?: string | null): Promise<{ success: boolean }> {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const dateDisplay = preferredDate || 'To be confirmed';
    const timeDisplay = preferredTime || 'To be confirmed';

    const result = await client.emails.send({
      from: fromEmail || 'noreply@resend.dev',
      to: toEmail,
      subject: 'Your Atbott Demo is Confirmed',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #2FA4BC 0%, #258da2 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Atbott</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0; font-size: 14px;">Wedding SaaS Platform</p>
          </div>
          <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
            <h2 style="color: #333; margin-top: 0;">Demo Confirmed!</h2>
            <p>Hi ${name},</p>
            <p>Your demo booking has been received. Here are your details:</p>
            <div style="background: #f8fafb; border-left: 4px solid #2FA4BC; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 24px 0;">
              <p style="margin: 4px 0; font-size: 15px;"><strong>Date:</strong> ${dateDisplay}</p>
              <p style="margin: 4px 0; font-size: 15px;"><strong>Time:</strong> ${timeDisplay}</p>
            </div>
            <p>Our team will contact you shortly to confirm the schedule and share the meeting link.</p>
            <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">
            <p style="color: #999; font-size: 12px; margin: 0;">– Team Atbott</p>
          </div>
        </body>
        </html>
      `
    });

    console.log('[Email] Demo confirmation sent to:', toEmail, 'Result:', result);
    
    await storage.createEmailLog({
      recipient: toEmail,
      type: 'demo_confirmation',
      status: 'sent',
    });

    return { success: true };
  } catch (error: any) {
    console.error('[Email] Failed to send demo confirmation:', error);
    
    try {
      await storage.createEmailLog({
        recipient: toEmail,
        type: 'demo_confirmation',
        status: 'failed',
        errorMessage: error?.message || 'Unknown error',
      });
    } catch (logErr) {
      console.error('[Email] Failed to log email error:', logErr);
    }

    return { success: false };
  }
}

export async function sendSignupWelcomeEmail(toEmail: string, name: string, companyName: string, plan: string): Promise<{ success: boolean }> {
  try {
    const { client, fromEmail } = await getResendClient();

    const result = await client.emails.send({
      from: fromEmail || 'noreply@resend.dev',
      to: toEmail,
      subject: 'Welcome to Atbott - Your Account is Ready!',
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #2FA4BC 0%, #258da2 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to Atbott!</h1>
          </div>
          <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
            <p>Hi ${name},</p>
            <p>Your account for <strong>${companyName}</strong> has been created successfully on the <strong>${plan}</strong> plan.</p>
            <p>You can now log in and start managing your events.</p>
            <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">
            <p style="color: #999; font-size: 12px; margin: 0;">– Team Atbott</p>
          </div>
        </body>
        </html>
      `
    });

    console.log('[Email] Signup welcome sent to:', toEmail);
    await storage.createEmailLog({ recipient: toEmail, type: 'signup_welcome', status: 'sent' });
    return { success: true };
  } catch (error: any) {
    console.error('[Email] Failed to send signup welcome:', error);
    try { await storage.createEmailLog({ recipient: toEmail, type: 'signup_welcome', status: 'failed', errorMessage: error?.message }); } catch {}
    return { success: false };
  }
}

const ADMIN_NOTIFICATION_EMAIL = 'atbottsaas@gmail.com';

export async function sendAdminNotificationEmail(subject: string, bodyHtml: string): Promise<{ success: boolean }> {
  try {
    const { client, fromEmail } = await getResendClient();

    const result = await client.emails.send({
      from: fromEmail || 'noreply@resend.dev',
      to: ADMIN_NOTIFICATION_EMAIL,
      subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #2FA4BC 0%, #258da2 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Atbott Admin Alert</h1>
          </div>
          <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
            ${bodyHtml}
            <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">
            <p style="color: #999; font-size: 12px; margin: 0;">This is an automated notification from Atbott SaaS Platform.</p>
          </div>
        </body>
        </html>
      `
    });

    console.log('[Email] Admin notification sent to:', ADMIN_NOTIFICATION_EMAIL, 'Result:', result);
    await storage.createEmailLog({ recipient: ADMIN_NOTIFICATION_EMAIL, type: 'admin_notification', status: 'sent' });
    return { success: true };
  } catch (error: any) {
    console.error('[Email] Failed to send admin notification:', error);
    try { await storage.createEmailLog({ recipient: ADMIN_NOTIFICATION_EMAIL, type: 'admin_notification', status: 'failed', errorMessage: error?.message }); } catch {}
    return { success: false };
  }
}

export async function sendDemoAdminNotification(name: string, companyName: string, email: string, phone: string, businessType?: string | null, preferredDate?: string | null, preferredTime?: string | null): Promise<{ success: boolean }> {
  const bodyHtml = `
    <h2 style="color: #333; margin-top: 0;">🚀 New Demo Request</h2>
    <div style="background: #f8fafb; border-left: 4px solid #2FA4BC; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 20px 0;">
      <p style="margin: 4px 0;"><strong>Name:</strong> ${name}</p>
      <p style="margin: 4px 0;"><strong>Company:</strong> ${companyName}</p>
      <p style="margin: 4px 0;"><strong>Email:</strong> ${email}</p>
      <p style="margin: 4px 0;"><strong>Phone:</strong> ${phone}</p>
      ${businessType ? `<p style="margin: 4px 0;"><strong>Business Type:</strong> ${businessType}</p>` : ''}
      <p style="margin: 4px 0;"><strong>Preferred Date:</strong> ${preferredDate || 'Not specified'}</p>
      <p style="margin: 4px 0;"><strong>Preferred Time:</strong> ${preferredTime || 'Not specified'}</p>
    </div>
    <p>Please follow up with this lead at the earliest.</p>
  `;
  return sendAdminNotificationEmail('🚀 New Demo Request - ' + companyName, bodyHtml);
}

export async function sendSignupAdminNotification(name: string, companyName: string, email: string, phone: string, plan: string): Promise<{ success: boolean }> {
  const bodyHtml = `
    <h2 style="color: #333; margin-top: 0;">🎉 New Signup</h2>
    <div style="background: #f8fafb; border-left: 4px solid #2FA4BC; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 20px 0;">
      <p style="margin: 4px 0;"><strong>Name:</strong> ${name}</p>
      <p style="margin: 4px 0;"><strong>Company:</strong> ${companyName}</p>
      <p style="margin: 4px 0;"><strong>Email:</strong> ${email}</p>
      <p style="margin: 4px 0;"><strong>Phone:</strong> ${phone}</p>
      <p style="margin: 4px 0;"><strong>Plan:</strong> ${plan}</p>
    </div>
    <p>A new user has signed up. You may review and onboard them.</p>
  `;
  return sendAdminNotificationEmail('🎉 New Signup - ' + companyName, bodyHtml);
}

export async function sendEnterpriseAdminNotification(companyName: string, contactName: string, contactEmail: string, contactPhone: string, teamSize?: string | null, eventsPerMonth?: string | null): Promise<{ success: boolean }> {
  const bodyHtml = `
    <h2 style="color: #333; margin-top: 0;">🏢 New Enterprise Inquiry</h2>
    <div style="background: #f8fafb; border-left: 4px solid #2FA4BC; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 20px 0;">
      <p style="margin: 4px 0;"><strong>Company:</strong> ${companyName}</p>
      <p style="margin: 4px 0;"><strong>Contact:</strong> ${contactName}</p>
      <p style="margin: 4px 0;"><strong>Email:</strong> ${contactEmail}</p>
      <p style="margin: 4px 0;"><strong>Phone:</strong> ${contactPhone}</p>
      ${teamSize ? `<p style="margin: 4px 0;"><strong>Team Size:</strong> ${teamSize}</p>` : ''}
      ${eventsPerMonth ? `<p style="margin: 4px 0;"><strong>Events/Month:</strong> ${eventsPerMonth}</p>` : ''}
    </div>
    <p>This is a high-value enterprise lead. Please prioritize follow-up.</p>
  `;
  return sendAdminNotificationEmail('🏢 Enterprise Inquiry - ' + companyName, bodyHtml);
}

export async function sendPaymentSuccessAdminNotification(userName: string, userEmail: string, companyName: string, planName: string, amount: number): Promise<{ success: boolean }> {
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const bodyHtml = `
    <h2 style="color: #333; margin-top: 0;">💰 Payment Received</h2>
    <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 20px 0;">
      <p style="margin: 4px 0;"><strong>Name:</strong> ${userName}</p>
      <p style="margin: 4px 0;"><strong>Email:</strong> ${userEmail}</p>
      <p style="margin: 4px 0;"><strong>Company:</strong> ${companyName}</p>
      <p style="margin: 4px 0;"><strong>Plan:</strong> ${planName}</p>
      <p style="margin: 4px 0;"><strong>Amount:</strong> ₹${amount.toLocaleString('en-IN')}</p>
      <p style="margin: 4px 0;"><strong>Time:</strong> ${timestamp}</p>
    </div>
    <p>A new subscription payment has been received and the plan has been activated.</p>
  `;
  return sendAdminNotificationEmail('💰 Payment Received - ' + companyName + ' (₹' + amount.toLocaleString('en-IN') + ')', bodyHtml);
}

export async function sendPaymentFailedAdminNotification(userName: string, userEmail: string, companyName: string, planName: string, amount: number, errorReason?: string): Promise<{ success: boolean }> {
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const bodyHtml = `
    <h2 style="color: #333; margin-top: 0;">❌ Payment Failed</h2>
    <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 20px 0;">
      <p style="margin: 4px 0;"><strong>Name:</strong> ${userName}</p>
      <p style="margin: 4px 0;"><strong>Email:</strong> ${userEmail}</p>
      <p style="margin: 4px 0;"><strong>Company:</strong> ${companyName}</p>
      <p style="margin: 4px 0;"><strong>Plan:</strong> ${planName}</p>
      <p style="margin: 4px 0;"><strong>Amount:</strong> ₹${amount.toLocaleString('en-IN')}</p>
      <p style="margin: 4px 0;"><strong>Error:</strong> ${errorReason || 'Unknown'}</p>
      <p style="margin: 4px 0;"><strong>Time:</strong> ${timestamp}</p>
    </div>
    <p style="color: #dc2626; font-weight: 600;">Action required: Follow up with the customer about the failed payment.</p>
  `;
  return sendAdminNotificationEmail('❌ Payment Failed - ' + companyName, bodyHtml);
}

export async function sendEnterpriseAcknowledgmentEmail(toEmail: string, contactName: string, companyName: string): Promise<{ success: boolean }> {
  try {
    const { client, fromEmail } = await getResendClient();

    const result = await client.emails.send({
      from: fromEmail || 'noreply@resend.dev',
      to: toEmail,
      subject: 'Atbott Enterprise - We Received Your Inquiry',
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #2FA4BC 0%, #258da2 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Atbott Enterprise</h1>
          </div>
          <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px;">
            <p>Hi ${contactName},</p>
            <p>Thank you for your interest in Atbott Enterprise for <strong>${companyName}</strong>.</p>
            <p>Our team will reach out within 24 hours to discuss your requirements and schedule a personalized demo.</p>
            <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">
            <p style="color: #999; font-size: 12px; margin: 0;">– Team Atbott</p>
          </div>
        </body>
        </html>
      `
    });

    console.log('[Email] Enterprise acknowledgment sent to:', toEmail);
    await storage.createEmailLog({ recipient: toEmail, type: 'enterprise_acknowledgment', status: 'sent' });
    return { success: true };
  } catch (error: any) {
    console.error('[Email] Failed to send enterprise acknowledgment:', error);
    try { await storage.createEmailLog({ recipient: toEmail, type: 'enterprise_acknowledgment', status: 'failed', errorMessage: error?.message }); } catch {}
    return { success: false };
  }
}
