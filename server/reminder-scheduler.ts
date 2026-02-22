import { storage } from "./storage";
import { sendWhatsAppMessage, sendGeneralNotification, sendRsvpWhatsApp } from "./whatsapp-service";
import { sendPushToUser, sendOaksyNotification } from "./push-notification-service";
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { db } from "./db";
import { cashflowEntries, liabilities } from "@shared/schema";
import { eq, and, lte, sql } from "drizzle-orm";

let schedulerInterval: NodeJS.Timeout | null = null;

// Superadmin phone for executive reports
const SUPERADMIN_PHONE = '+917902373354';
const INDIA_TIMEZONE = 'Asia/Kolkata';

/**
 * Get current date/time in IST as formatted string
 */
function getISTDate(date: Date = new Date()): string {
  return formatInTimeZone(date, INDIA_TIMEZONE, 'yyyy-MM-dd');
}

function getISTHour(date: Date = new Date()): number {
  return parseInt(formatInTimeZone(date, INDIA_TIMEZONE, 'H'), 10);
}

function getISTMinute(date: Date = new Date()): number {
  return parseInt(formatInTimeZone(date, INDIA_TIMEZONE, 'm'), 10);
}

/**
 * Check if a report was already sent today (persisted in DB, survives restarts)
 */
async function wasReportSentToday(reportType: 'morning' | 'night'): Promise<boolean> {
  try {
    const type = `daily_${reportType}_report`;
    const logs = await storage.getNotificationLogsByType(type);
    if (logs.length === 0) return false;
    
    // Check if the most recent log is from today (IST)
    const todayIST = getISTDate(new Date());
    const lastLog = logs[0]; // Already sorted by createdAt DESC
    const logDateIST = getISTDate(new Date(lastLog.createdAt || ''));
    
    return logDateIST === todayIST;
  } catch (error) {
    console.error(`[Scheduler] Error checking if ${reportType} report was sent:`, error);
    return false; // If we can't check, err on the side of not sending duplicates
  }
}

/**
 * Log that a report was sent (persists to DB)
 */
async function logReportSent(reportType: 'morning' | 'night'): Promise<void> {
  try {
    await storage.createNotificationLog({
      eventId: null,
      type: `daily_${reportType}_report`,
      recipientPhone: SUPERADMIN_PHONE,
      recipientName: 'Kishor',
      message: `${reportType === 'morning' ? 'Morning' : 'Night'} business report sent`,
      status: 'sent'
    });
  } catch (error) {
    console.error(`[Scheduler] Failed to log ${reportType} report:`, error);
  }
}

const WEDDING_PLANNER_PHONES: Record<string, string> = {
  'fida fathima': '+919895810975',
  'fida': '+919895810975',
  'fida fathima pk': '+919895810975',
  'femina km': '+917306687284',
  'femina': '+917306687284',
};

function getWeddingPlannerPhone(plannerName: string): string | null {
  const normalized = plannerName.toLowerCase().trim();
  for (const [key, phone] of Object.entries(WEDDING_PLANNER_PHONES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return phone;
    }
  }
  return null;
}

export async function processReminders(): Promise<void> {
  try {
    const dueReminders = await storage.getDueReminders();
    
    for (const reminder of dueReminders) {
      try {
        const message = `🔔 *Reminder from Oaksy*\n\n${reminder.reminderMessage}\n\n_Set on ${new Date(reminder.createdAt!).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}_`;
        
        await sendGeneralNotification(reminder.employeePhone, reminder.employeeName, message, 'scheduled_reminder');
        await storage.markReminderAsSent(reminder.id);
        
        console.log(`[Reminder Scheduler] Sent reminder to ${reminder.employeeName}: ${reminder.reminderMessage.substring(0, 50)}...`);
      } catch (error) {
        console.error(`[Reminder Scheduler] Failed to send reminder ${reminder.id}:`, error);
      }
    }
    
    if (dueReminders.length > 0) {
      console.log(`[Reminder Scheduler] Processed ${dueReminders.length} reminders`);
    }
  } catch (error) {
    console.error('[Reminder Scheduler] Error processing reminders:', error);
  }
}

export async function process60DayPaymentReminders(): Promise<void> {
  try {
    const eventsDue = await storage.getEventsDueFor60DayReminder();
    
    for (const event of eventsDue) {
      try {
        const plannerPhone = getWeddingPlannerPhone(event.planner);
        
        if (!plannerPhone) {
          console.log(`[60-Day Reminder] No phone found for planner: ${event.planner} - skipping event ${event.id}`);
          continue;
        }
        
        const message = `💰 *Payment Milestone Alert (40%)*\n\n*${event.title}* is scheduled in 2 months.\n\nPlease ensure first payment milestone (40%) is collected and receipt is uploaded.\n\n_Event Date: ${new Date(event.date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}_`;
        
        await sendGeneralNotification(plannerPhone, event.planner || 'Planner', message, '60day_payment_reminder');
        await storage.markEvent60DayReminderSent(event.id);
        
        await storage.createNotificationLog({
          eventId: event.id,
          type: 'payment_60day',
          recipientPhone: plannerPhone,
          recipientName: event.planner,
          message: message,
          status: 'sent'
        });
        
        console.log(`[60-Day Reminder] Sent payment reminder for event "${event.title}" to ${event.planner} (${plannerPhone})`);
      } catch (error) {
        console.error(`[60-Day Reminder] Failed to send reminder for event ${event.id}:`, error);
        
        try {
          await storage.createNotificationLog({
            eventId: event.id,
            type: 'payment_60day',
            recipientPhone: getWeddingPlannerPhone(event.planner) || 'unknown',
            recipientName: event.planner,
            message: `Failed to send reminder: ${error}`,
            status: 'failed'
          });
        } catch (logError) {
          console.error(`[60-Day Reminder] Failed to log error:`, logError);
        }
      }
    }
    
    if (eventsDue.length > 0) {
      console.log(`[60-Day Reminder] Processed ${eventsDue.length} payment reminders`);
    }
  } catch (error) {
    console.error('[60-Day Reminder] Error processing payment reminders:', error);
  }
}

/**
 * Send daily morning business report to Kishor at 7:00 AM IST
 */
export async function sendMorningBusinessReport(): Promise<void> {
  try {
    const now = new Date();
    const currentHour = getISTHour(now);
    const currentMinute = getISTMinute(now);
    const todayDate = getISTDate(now);
    
    // Only send between 7:00 AM and 7:05 AM IST
    if (currentHour !== 7 || currentMinute > 5) {
      return;
    }
    
    // Check if we've already sent today (persisted in DB, survives restarts)
    if (await wasReportSentToday('morning')) {
      return;
    }
    
    console.log('[Morning Report] Preparing daily business report for Kishor...');
    
    // Get yesterday's date in IST
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayDate = getISTDate(yesterday);
    
    // Get this month's date range in IST
    const yearMonth = todayDate.substring(0, 7); // "YYYY-MM"
    const monthStartStr = `${yearMonth}-01`;
    const monthEndStr = todayDate;
    
    // Fetch data for the report
    let yesterdaySales = 0;
    let monthlySales = 0;
    let todaysEvents = 0;
    let todaysMeetings = 0;
    let pendingVendorPayments = 0;
    let pendingClientDues = 0;
    
    try {
      // Get daybook entries for yesterday's sales
      const yesterdayEntries = await storage.getDaybookEntriesByDateRange(yesterdayDate, yesterdayDate);
      yesterdaySales = yesterdayEntries
        .filter((e: any) => e.type === 'income')
        .reduce((sum: number, e: any) => sum + parseFloat(e.amount || '0'), 0);
      
      // Get monthly sales
      const monthlyEntries = await storage.getDaybookEntriesByDateRange(monthStartStr, monthEndStr);
      monthlySales = monthlyEntries
        .filter((e: any) => e.type === 'income')
        .reduce((sum: number, e: any) => sum + parseFloat(e.amount || '0'), 0);
      
      // Get today's events
      const events = await storage.getAllEvents();
      todaysEvents = events.filter((e: any) => e.date === todayDate).length;
      
      // Get today's meetings
      const meetings = await storage.getAllMeetings();
      todaysMeetings = meetings.filter((m: any) => {
        const meetingDate = getISTDate(new Date(m.scheduledAt || m.createdAt || now));
        return meetingDate === todayDate;
      }).length;
      
      // Get pending vendor payments (expenses with pending status)
      const expenses = await storage.getAllExpenseReimbursements();
      pendingVendorPayments = expenses
        .filter((e: any) => e.status === 'pending')
        .reduce((sum: number, e: any) => sum + parseFloat(e.amount || '0'), 0);
      
      // Get pending client dues (events with outstanding balance)
      pendingClientDues = events.reduce((sum: number, e: any) => {
        const salesValue = parseFloat(e.salesValue || '0');
        const paymentReceived = parseFloat(e.paymentReceived || '0');
        return sum + Math.max(0, salesValue - paymentReceived);
      }, 0);
      
    } catch (dataError) {
      console.error('[Morning Report] Error fetching data:', dataError);
    }
    
    const message = `Good morning Kishor ☀️

*Yesterday Sales:* ₹${yesterdaySales.toLocaleString('en-IN')}
*Monthly Total:* ₹${monthlySales.toLocaleString('en-IN')}
*Today's Events:* ${todaysEvents}
*Today's Meetings:* ${todaysMeetings}
*Pending Vendor Payments:* ₹${pendingVendorPayments.toLocaleString('en-IN')}
*Pending Client Dues:* ₹${pendingClientDues.toLocaleString('en-IN')}

_Your Oaksy daily briefing 🌳_`;
    
    const result = await sendGeneralNotification(SUPERADMIN_PHONE, 'Kishor', message, 'daily_morning_report');
    if (result.success) {
      await logReportSent('morning');
      console.log('[Morning Report] Sent daily business report to Kishor');
    } else {
      console.error('[Morning Report] Failed to send:', result.error);
    }
  } catch (error) {
    console.error('[Morning Report] Error:', error);
  }
}

/**
 * Send night reminder summary to Kishor after 9:00 PM IST
 */
export async function sendNightReminderSummary(): Promise<void> {
  try {
    const now = new Date();
    const currentHour = getISTHour(now);
    const currentMinute = getISTMinute(now);
    
    // Only send between 9:00 PM and 9:05 PM IST
    if (currentHour !== 21 || currentMinute > 5) {
      return;
    }
    
    // Check if we've already sent today (persisted in DB, survives restarts)
    if (await wasReportSentToday('night')) {
      return;
    }
    
    console.log('[Night Summary] Preparing reminder summary for Kishor...');
    
    // Get tomorrow's date in IST
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowDate = getISTDate(tomorrow);
    
    // Get 3 days from now
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const threeDaysStr = getISTDate(threeDaysLater);
    
    let tomorrowMeetings = 0;
    let tomorrowEvents = 0;
    let tomorrowVendorPayments = 0;
    let upcomingDeadlines = 0;
    
    try {
      // Get tomorrow's meetings
      const meetings = await storage.getAllMeetings();
      tomorrowMeetings = meetings.filter((m: any) => {
        const meetingDate = getISTDate(new Date(m.scheduledAt || m.createdAt || now));
        return meetingDate === tomorrowDate;
      }).length;
      
      // Get tomorrow's events
      const events = await storage.getAllEvents();
      tomorrowEvents = events.filter((e: any) => e.date === tomorrowDate).length;
      
      // Get pending expenses/vendor payments
      const expenses = await storage.getAllExpenseReimbursements();
      tomorrowVendorPayments = expenses.filter((e: any) => e.status === 'pending').length;
      
      // Get upcoming deadlines (events in next 3 days)
      upcomingDeadlines = events.filter((e: any) => {
        if (!e.date) return false;
        return e.date >= tomorrowDate && e.date <= threeDaysStr;
      }).length;
      
    } catch (dataError) {
      console.error('[Night Summary] Error fetching data:', dataError);
    }
    
    const message = `🔔 *Tomorrow Reminder Summary*

*Meetings:* ${tomorrowMeetings}
*Events:* ${tomorrowEvents}
*Vendor Payments Due:* ${tomorrowVendorPayments}
*Deadlines (3 days):* ${upcomingDeadlines}

_Rest well, Kishor! 🌙_`;
    
    const result = await sendGeneralNotification(SUPERADMIN_PHONE, 'Kishor', message, 'daily_night_summary');
    if (result.success) {
      await logReportSent('night');
      console.log('[Night Summary] Sent reminder summary to Kishor');
    } else {
      console.error('[Night Summary] Failed to send:', result.error);
    }
  } catch (error) {
    console.error('[Night Summary] Error:', error);
  }
}

/**
 * Process RSVP reminders - send to guests who haven't responded 7 days and 24 hours before event
 */
export async function processRsvpReminders(): Promise<void> {
  try {
    const now = new Date();
    const events = await storage.getAllEvents();
    
    for (const event of events) {
      if (!event.date) continue;
      
      const eventDate = new Date(event.date);
      const hoursUntilEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      const daysUntilEvent = hoursUntilEvent / 24;
      
      // Skip if event is in the past or more than 8 days away
      if (hoursUntilEvent < 0 || daysUntilEvent > 8) continue;
      
      // Get guests for this event
      const guests = await storage.getEventGuestsByEvent(event.id);
      
      for (const guest of guests) {
        // Check if guest has responded
        const response = await storage.getRsvpResponseByGuest(guest.id);
        if (response && response.attendanceStatus !== 'pending') continue;
        
        // 7 day reminder (between 7 days and 6.5 days - 168 to 156 hours)
        if (hoursUntilEvent <= 168 && hoursUntilEvent > 156 && !(guest as any).reminder7DaySent) {
          try {
            const eventName = event.customer || event.title;
            const rsvpCode = event.rsvpCode;
            const rsvpPageLink = rsvpCode 
              ? `${process.env.REPLIT_DEV_DOMAIN || 'https://your-app.replit.app'}/rsvp/e/${rsvpCode}` 
              : '';
            
            if (rsvpPageLink) {
              await sendRsvpWhatsApp(guest.phone, guest.name, eventName, rsvpPageLink);
            } else {
              const message = `🎉 *RSVP Reminder*\n\nHi ${guest.name}! 👋\n\nFriendly reminder about *${eventName}* on ${format(eventDate, 'MMM d')}!\n\nWe noticed you haven't responded yet. Will you be attending?`;
              await sendGeneralNotification(guest.phone, guest.name, message, 'rsvp_7day_reminder');
            }
            await storage.updateEventGuest(guest.id, { reminder7DaySent: true } as any);
            
            console.log(`[RSVP Reminder] Sent 7-day reminder to ${guest.name} for event "${event.title}"`);
          } catch (error) {
            console.error(`[RSVP Reminder] Failed to send 7-day reminder to ${guest.name}:`, error);
          }
        }
        
        // 24h reminder (between 24 and 23 hours) - Final reminder
        if (hoursUntilEvent <= 24 && hoursUntilEvent > 23 && !guest.reminder24hSent) {
          try {
            const eventName = event.customer || event.title;
            const rsvpCode = event.rsvpCode;
            const rsvpPageLink = rsvpCode 
              ? `${process.env.REPLIT_DEV_DOMAIN || 'https://your-app.replit.app'}/rsvp/e/${rsvpCode}` 
              : '';
            
            if (rsvpPageLink) {
              await sendRsvpWhatsApp(guest.phone, guest.name, eventName, rsvpPageLink);
            } else {
              const message = `⏰ *Final RSVP Reminder*\n\nHi ${guest.name}!\n\n*${eventName}* is TOMORROW!\n\nThis is your final reminder to confirm attendance.`;
              await sendGeneralNotification(guest.phone, guest.name, message, 'rsvp_24h_reminder');
            }
            await storage.updateEventGuest(guest.id, { reminder24hSent: true });
            
            console.log(`[RSVP Reminder] Sent 24h reminder to ${guest.name} for event "${event.title}"`);
          } catch (error) {
            console.error(`[RSVP Reminder] Failed to send 24h reminder to ${guest.name}:`, error);
          }
        }
      }
    }
  } catch (error) {
    console.error('[RSVP Reminder] Error processing RSVP reminders:', error);
  }
}

/**
 * Process configurable RSVP follow-up reminders based on event rsvpSettings.
 * Sends WhatsApp messages to guests with "maybe" or no response after configured days.
 */
export async function processConfigurableRsvpReminders(): Promise<void> {
  try {
    const now = new Date();
    const events = await storage.getAllEvents();
    
    for (const event of events) {
      if (!event.date) continue;
      const settings = (event as any).rsvpSettings;
      if (!settings || !settings.reminderEnabled) continue;
      
      const eventDate = new Date(event.date);
      if (eventDate.getTime() < now.getTime()) continue;
      
      const reminderDays = settings.reminderDays || 10;
      const lastRun = settings.lastReminderRun ? new Date(settings.lastReminderRun) : null;
      
      if (lastRun) {
        const hoursSinceLastRun = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastRun < 24) continue;
      }
      
      const guests = await storage.getEventGuestsByEvent(event.id);
      let sentCount = 0;
      
      for (const guest of guests) {
        if (!guest.phone) continue;
        
        const response = await storage.getRsvpResponseByGuest(guest.id);
        const shouldRemind = !response || 
          response.attendanceStatus === 'pending' || 
          response.attendanceStatus === 'maybe';
        
        if (!shouldRemind) continue;
        
        const referenceDate = response?.respondedAt 
          ? new Date(response.respondedAt) 
          : (guest as any).createdAt 
            ? new Date((guest as any).createdAt) 
            : null;
        
        if (!referenceDate) continue;
        
        const daysSinceRef = (now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceRef < reminderDays) continue;
        
        try {
          const eventName = event.customer || event.title;
          const rsvpCode = event.rsvpCode;
          const rsvpLink = rsvpCode 
            ? `${process.env.REPLIT_DEV_DOMAIN || 'https://your-app.replit.app'}/rsvp/e/${rsvpCode}` 
            : '';
          
          const statusText = response?.attendanceStatus === 'maybe' 
            ? "You mentioned you're unsure about attending" 
            : "We haven't received your response yet";
          
          if (rsvpLink) {
            await sendRsvpWhatsApp(guest.phone, guest.name, eventName, rsvpLink);
          } else {
            const message = `🔔 *RSVP Follow-up*\n\nHi ${guest.name}! 👋\n\n${statusText} for *${eventName}* on *${format(eventDate, 'MMM d, yyyy')}*.\n\nWe'd love to have you! Please confirm your attendance so we can make the best arrangements for you.`;
            await sendGeneralNotification(guest.phone, guest.name, message, 'rsvp_configurable_reminder');
          }
          sentCount++;
          
          console.log(`[RSVP Config Reminder] Sent follow-up to ${guest.name} for "${event.title}"`);
        } catch (error) {
          console.error(`[RSVP Config Reminder] Failed for ${guest.name}:`, error);
        }
      }
      
      if (sentCount > 0) {
        try {
          await storage.updateEvent(event.id, {
            rsvpSettings: { ...settings, lastReminderRun: now.toISOString() }
          } as any);
          console.log(`[RSVP Config Reminder] Sent ${sentCount} reminders for "${event.title}", updated lastReminderRun`);
        } catch (error) {
          console.error(`[RSVP Config Reminder] Failed to update lastReminderRun:`, error);
        }
      }
    }
  } catch (error) {
    console.error('[RSVP Config Reminder] Error:', error);
  }
}

/**
 * Send 24-hour reminders to wedding planners who haven't updated lead stage
 */
async function processPortalLeadReminders(): Promise<void> {
  try {
    // Get all portal leads that are assigned but haven't been updated in 24 hours
    const { db } = await import('./db');
    const { portalLeads, users } = await import('@shared/schema');
    const { eq, and, lt, isNull, isNotNull, or } = await import('drizzle-orm');
    
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Find leads that:
    // 1. Have an assigned planner
    // 2. Phase is still 'assigned' (not progressed)
    // 3. Either phaseUpdatedAt is older than 24 hours OR assignedAt is older than 24 hours (fallback)
    // 4. Reminder hasn't been sent yet
    const staleLeads = await db.select()
      .from(portalLeads)
      .where(
        and(
          isNotNull(portalLeads.assignedPlannerId),
          eq(portalLeads.phase, 'assigned'),
          isNull(portalLeads.reminderSentAt),
          or(
            lt(portalLeads.phaseUpdatedAt, twentyFourHoursAgo),
            and(
              isNull(portalLeads.phaseUpdatedAt),
              lt(portalLeads.assignedAt, twentyFourHoursAgo)
            ),
            and(
              isNull(portalLeads.phaseUpdatedAt),
              isNull(portalLeads.assignedAt),
              lt(portalLeads.updatedAt, twentyFourHoursAgo)
            )
          )
        )
      );
    
    for (const lead of staleLeads) {
      if (!lead.assignedPlannerId) continue;
      
      // Get planner details
      const [planner] = await db.select().from(users).where(eq(users.id, lead.assignedPlannerId));
      if (!planner) continue;
      
      // Get planner's employee record for phone number
      const { employees } = await import('@shared/schema');
      const [employee] = await db.select().from(employees).where(eq(employees.email, planner.email));
      
      if (employee?.phone) {
        const reminderMessage = `⏰ *Reminder: Lead Pending Update*\n\n` +
          `Hi ${planner.name},\n\n` +
          `The lead *${lead.name}* was assigned to you 24 hours ago but the status hasn't been updated.\n\n` +
          `📞 Customer: ${lead.phone}\n` +
          `📧 Email: ${lead.email}\n` +
          `${lead.eventType ? `🎉 Event: ${lead.eventType}` : ''}\n\n` +
          `Please contact the customer and update the lead status in Oak Sales.\n\n` +
          `— Event Management System`;
        
        try {
          await sendGeneralNotification(employee.phone, planner.name, reminderMessage, 'stale_portal_lead_reminder', lead.id);
          
          await db.update(portalLeads)
            .set({ reminderSentAt: new Date() })
            .where(eq(portalLeads.id, lead.id));
          
          console.log(`[Portal Lead Reminder] Sent 24h reminder to ${planner.name} for lead ${lead.name}`);
        } catch (error) {
          console.error(`[Portal Lead Reminder] Failed to send reminder for ${lead.name}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('[Portal Lead Reminder] Error processing reminders:', error);
  }
}

async function wasScheduledNotificationSentToday(notificationType: string, identifier?: string): Promise<boolean> {
  try {
    const type = identifier ? `${notificationType}_${identifier}` : notificationType;
    const logs = await storage.getNotificationLogsByType(type);
    if (logs.length === 0) return false;
    const todayIST = getISTDate(new Date());
    const lastLog = logs[0];
    const logDateIST = getISTDate(new Date(lastLog.createdAt || ''));
    return logDateIST === todayIST;
  } catch (error) {
    console.error(`[Scheduler] Error checking if ${notificationType} was sent:`, error);
    return false;
  }
}

async function logScheduledNotificationSent(notificationType: string, message: string, eventId?: string | null, identifier?: string): Promise<void> {
  try {
    const type = identifier ? `${notificationType}_${identifier}` : notificationType;
    await storage.createNotificationLog({
      eventId: eventId || null,
      type,
      recipientPhone: 'push_notification',
      recipientName: 'system',
      message,
      status: 'sent'
    });
  } catch (error) {
    console.error(`[Scheduler] Failed to log ${notificationType}:`, error);
  }
}

async function processAttendanceReminders(): Promise<void> {
  try {
    const now = new Date();
    const currentHour = getISTHour(now);
    const currentMinute = getISTMinute(now);
    const todayDate = getISTDate(now);

    // Skip Sundays (in date-fns 'e' format: 1=Sunday, 2=Monday, ... 7=Saturday)
    const dayOfWeek = parseInt(formatInTimeZone(now, INDIA_TIMEZONE, 'e'), 10);
    if (dayOfWeek === 1) return;

    // Check-in reminder at 9:30 AM IST, check-out reminder at 5:30 PM IST
    const isCheckinTime = currentHour === 9 && currentMinute >= 30 && currentMinute <= 35;
    const isCheckoutTime = currentHour === 17 && currentMinute >= 30 && currentMinute <= 35;

    if (!isCheckinTime && !isCheckoutTime) return;

    const { db } = await import('./db');
    const { employeeAttendance, employees, users } = await import('@shared/schema');
    const { eq, and } = await import('drizzle-orm');

    if (isCheckinTime) {
      if (await wasScheduledNotificationSentToday('attendance_checkin_reminder')) return;

      const activeEmployees = await db.select().from(employees).where(eq(employees.isActive, true));
      const todayAttendance = await db.select().from(employeeAttendance).where(eq(employeeAttendance.date, todayDate));
      const checkedInEmployeeIds = new Set(todayAttendance.map(a => a.employeeId));

      let sentCount = 0;
      for (const emp of activeEmployees) {
        if (checkedInEmployeeIds.has(emp.id)) continue;
        if (!emp.email) continue;

        const [user] = await db.select().from(users).where(eq(users.email, emp.email));
        if (!user) continue;

        try {
          await sendOaksyNotification(
            user.id,
            emp.name,
            `you haven't checked in yet today. Please mark your attendance now.`,
            '/attendance',
            'warning'
          );
          sentCount++;
        } catch (err) {
          console.error(`[Attendance Reminder] Failed to send check-in reminder to ${emp.name}:`, err);
        }
      }

      if (sentCount > 0) {
        await logScheduledNotificationSent('attendance_checkin_reminder', `Sent check-in reminders to ${sentCount} employees`);
        console.log(`[Attendance Reminder] Sent check-in reminders to ${sentCount} employees`);
      }
    }

    if (isCheckoutTime) {
      if (await wasScheduledNotificationSentToday('attendance_checkout_reminder')) return;

      const todayAttendance = await db.select().from(employeeAttendance).where(
        and(eq(employeeAttendance.date, todayDate), eq(employeeAttendance.status, 'checked_in'))
      );

      let sentCount = 0;
      for (const attendance of todayAttendance) {
        const [emp] = await db.select().from(employees).where(eq(employees.id, attendance.employeeId));
        if (!emp || !emp.email) continue;

        const [user] = await db.select().from(users).where(eq(users.email, emp.email));
        if (!user) continue;

        try {
          await sendOaksyNotification(
            user.id,
            emp.name,
            `you haven't checked out yet. Please mark your check-out before leaving.`,
            '/attendance',
            'warning'
          );
          sentCount++;
        } catch (err) {
          console.error(`[Attendance Reminder] Failed to send check-out reminder to ${emp.name}:`, err);
        }
      }

      if (sentCount > 0) {
        await logScheduledNotificationSent('attendance_checkout_reminder', `Sent check-out reminders to ${sentCount} employees`);
        console.log(`[Attendance Reminder] Sent check-out reminders to ${sentCount} employees`);
      }
    }
  } catch (error) {
    console.error('[Attendance Reminder] Error:', error);
  }
}

function getStaleThresholdHours(stageName: string): number {
  const name = stageName.toLowerCase();
  if (name.includes('lead') || name.includes('awaiting response') || name.includes('contacted') || name.includes('prospective')) {
    return 24;
  }
  if (name.includes('proposal') || name.includes('negotiation') || name.includes('advance received')) {
    return 30 * 24;
  }
  if (name.includes('closed won') || name.includes('closed lost')) {
    return 60 * 24;
  }
  return 7 * 24;
}

function getStaleThresholdLabel(stageName: string): string {
  const name = stageName.toLowerCase();
  if (name.includes('lead') || name.includes('awaiting response') || name.includes('contacted') || name.includes('prospective')) {
    return '24 hours';
  }
  if (name.includes('proposal') || name.includes('negotiation') || name.includes('advance received')) {
    return '1 month';
  }
  if (name.includes('closed won') || name.includes('closed lost')) {
    return '2 months';
  }
  return '7 days';
}

async function processStaleSalesLeadReminders(): Promise<void> {
  try {
    const now = new Date();
    const currentHour = getISTHour(now);

    if (currentHour < 9 || currentHour > 18) return;

    const { db } = await import('./db');
    const { salesDeals, salesStages, users } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');
    const { sendOaksyNotification } = await import('./push-notification-service');

    const openDeals = await db.select().from(salesDeals).where(eq(salesDeals.status, 'open'));

    let sentCount = 0;
    for (const deal of openDeals) {
      if (!deal.ownerId) continue;

      const [stage] = await db.select().from(salesStages).where(eq(salesStages.id, deal.stageId));
      if (!stage) continue;

      const stageName = stage.name;
      const thresholdHours = getStaleThresholdHours(stageName);

      const stageChangeDate = deal.stageChangedAt ? new Date(deal.stageChangedAt) : new Date(deal.createdAt || now);
      const hoursSinceChange = (now.getTime() - stageChangeDate.getTime()) / (1000 * 60 * 60);

      if (hoursSinceChange < thresholdHours) continue;

      const lastNotified = deal.lastStaleNotificationAt ? new Date(deal.lastStaleNotificationAt) : null;
      if (lastNotified) {
        const hoursSinceLastNotification = (now.getTime() - lastNotified.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastNotification < thresholdHours) continue;
      }

      const [owner] = await db.select().from(users).where(eq(users.id, deal.ownerId));
      if (!owner) continue;

      const daysSinceChange = Math.floor(hoursSinceChange / 24);
      const thresholdLabel = getStaleThresholdLabel(stageName);

      try {
        await sendOaksyNotification(
          deal.ownerId,
          owner.name || 'Planner',
          `your lead "${deal.title}" has been in "${stageName}" for ${daysSinceChange} day${daysSinceChange !== 1 ? 's' : ''} (threshold: ${thresholdLabel}). Please follow up or update the stage! 📋`,
          '/oak-sales',
          'warning'
        );

        await db.update(salesDeals)
          .set({ lastStaleNotificationAt: now })
          .where(eq(salesDeals.id, deal.id));

        sentCount++;
      } catch (err) {
        console.error(`[Stale Lead] Failed for deal ${deal.title}:`, err);
      }
    }

    if (sentCount > 0) {
      await logScheduledNotificationSent('stale_lead_reminder', `Sent ${sentCount} stale lead reminders`);
      console.log(`[Stale Lead] Sent ${sentCount} stage-aware stale lead reminders`);
    }
  } catch (error) {
    console.error('[Stale Lead] Error:', error);
  }
}

async function processBudgetAlerts(): Promise<void> {
  try {
    const now = new Date();
    const currentHour = getISTHour(now);
    const currentMinute = getISTMinute(now);

    if (currentHour !== 8 || currentMinute > 5) return;
    if (await wasScheduledNotificationSentToday('budget_alert')) return;

    const events = await storage.getAllEvents();
    const superadmins = await storage.getUsersByRole('superadmin');

    if (superadmins.length === 0) return;

    let alertCount = 0;
    for (const event of events) {
      const salesValue = parseFloat(event.salesValue?.toString() || '0');
      const cost = parseFloat(event.cost?.toString() || '0');

      if (salesValue <= 0) continue;

      const costRatio = cost / salesValue;
      if (costRatio < 0.8) continue;

      const eventLogType = `budget_alert_${event.id}`;
      if (await wasScheduledNotificationSentToday(eventLogType)) continue;

      const isCritical = costRatio >= 1;
      const alertType = isCritical ? '🔴 CRITICAL' : '🟡 WARNING';
      const percentage = Math.round(costRatio * 100);

      for (const admin of superadmins) {
        try {
          await sendPushToUser(admin.id, {
            title: `${alertType} Budget Alert`,
            body: `Event "${event.title}" - Cost is ${percentage}% of revenue. Revenue: ₹${salesValue.toLocaleString('en-IN')}, Cost: ₹${cost.toLocaleString('en-IN')}`,
            actionUrl: '/event-database',
            type: isCritical ? 'error' : 'warning',
            sound: true,
          });
        } catch (err) {
          console.error(`[Budget Alert] Failed for event ${event.title}:`, err);
        }
      }

      await logScheduledNotificationSent(eventLogType, `Budget alert for ${event.title} (${percentage}%)`, event.id);
      alertCount++;
    }

    if (alertCount > 0) {
      await logScheduledNotificationSent('budget_alert', `Sent ${alertCount} budget alerts`);
      console.log(`[Budget Alert] Sent ${alertCount} budget alerts`);
    }
  } catch (error) {
    console.error('[Budget Alert] Error:', error);
  }
}

async function processPreEventReminders(): Promise<void> {
  try {
    const now = new Date();
    const currentHour = getISTHour(now);
    const currentMinute = getISTMinute(now);

    if (currentHour !== 9 || currentMinute > 5) return;

    const events = await storage.getAllEvents();
    const todayDate = getISTDate(now);
    const { db } = await import('./db');
    const { users } = await import('@shared/schema');
    const { sql: sqlFn } = await import('drizzle-orm');

    const reminderDays = [7, 3, 1];

    for (const event of events) {
      if (!event.date) continue;

      const eventDate = new Date(event.date + 'T00:00:00+05:30');
      const diffMs = eventDate.getTime() - now.getTime();
      const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (!reminderDays.includes(daysUntil)) continue;

      const eventLogType = `pre_event_reminder_${event.id}_${daysUntil}d`;
      if (await wasScheduledNotificationSentToday(eventLogType)) continue;

      if (!event.planner) continue;

      const allUsers = await db.select().from(users);
      const plannerUser = allUsers.find(u =>
        u.name && u.name.toLowerCase().trim() === event.planner.toLowerCase().trim()
      );

      if (!plannerUser) continue;

      try {
        await sendPushToUser(plannerUser.id, {
          title: '📅 Event Reminder',
          body: `Event "${event.title}" is in ${daysUntil} day${daysUntil > 1 ? 's' : ''}. Please ensure all preparations are on track.`,
          actionUrl: '/event-database',
          type: 'info',
          sound: true,
        });
        await logScheduledNotificationSent(eventLogType, `Pre-event reminder for ${event.title} (${daysUntil} days)`, event.id);
        console.log(`[Pre-Event Reminder] Sent ${daysUntil}-day reminder for "${event.title}" to ${plannerUser.name}`);
      } catch (err) {
        console.error(`[Pre-Event Reminder] Failed for event ${event.title}:`, err);
      }
    }
  } catch (error) {
    console.error('[Pre-Event Reminder] Error:', error);
  }
}

async function processPostEventActions(): Promise<void> {
  try {
    const now = new Date();
    const currentHour = getISTHour(now);
    const currentMinute = getISTMinute(now);

    if (currentHour !== 10 || currentMinute > 5) return;
    if (await wasScheduledNotificationSentToday('post_event_actions')) return;

    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayDate = getISTDate(yesterday);

    const events = await storage.getAllEvents();
    const superadmins = await storage.getUsersByRole('superadmin');
    let processedCount = 0;

    for (const event of events) {
      if (!event.date || event.date !== yesterdayDate) continue;
      if (event.status !== 'active' && event.status !== 'confirmed') continue;

      try {
        await storage.updateEvent(event.id, { status: 'completed' });

        const revenue = parseFloat(event.salesValue?.toString() || '0');
        const cost = parseFloat(event.cost?.toString() || '0');
        const profit = revenue - cost;
        const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

        for (const admin of superadmins) {
          try {
            await sendPushToUser(admin.id, {
              title: '✅ Event Auto-Completed',
              body: `Event "${event.title}" has been auto-completed. P&L: Revenue ₹${revenue.toLocaleString('en-IN')}, Cost ₹${cost.toLocaleString('en-IN')}, Profit ₹${profit.toLocaleString('en-IN')} (${margin}%).`,
              actionUrl: '/event-database',
              type: 'success',
              sound: true,
            });
          } catch (err) {
            console.error(`[Post-Event] Failed to notify admin for ${event.title}:`, err);
          }
        }

        processedCount++;
        console.log(`[Post-Event] Auto-completed event "${event.title}"`);
      } catch (err) {
        console.error(`[Post-Event] Failed to auto-complete event ${event.title}:`, err);
      }
    }

    if (processedCount > 0) {
      await logScheduledNotificationSent('post_event_actions', `Auto-completed ${processedCount} events`);
      console.log(`[Post-Event] Auto-completed ${processedCount} events`);
    }
  } catch (error) {
    console.error('[Post-Event] Error:', error);
  }
}

async function processVendorPaymentAlerts(): Promise<void> {
  try {
    const now = new Date();
    const currentHour = getISTHour(now);
    const currentMinute = getISTMinute(now);

    if (currentHour !== 9 || currentMinute > 5) return;
    if (await wasScheduledNotificationSentToday('vendor_payment_alert')) return;

    const { db } = await import('./db');
    const { eventVendorCosts, events } = await import('@shared/schema');
    const { eq, and, gte, lte } = await import('drizzle-orm');

    const todayDate = getISTDate(now);
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const sevenDaysStr = getISTDate(sevenDaysLater);

    const pendingCosts = await db.select().from(eventVendorCosts).where(eq(eventVendorCosts.paymentStatus, 'pending'));

    const allEvents = await storage.getAllEvents();
    const upcomingEventIds = new Set(
      allEvents
        .filter(e => e.date && e.date >= todayDate && e.date <= sevenDaysStr)
        .map(e => e.id)
    );

    const pendingForUpcoming = pendingCosts.filter(c => upcomingEventIds.has(c.eventId));

    if (pendingForUpcoming.length === 0) return;

    const superadmins = await storage.getUsersByRole('superadmin');
    for (const admin of superadmins) {
      try {
        await sendPushToUser(admin.id, {
          title: '💰 Vendor Payment Alert',
          body: `${pendingForUpcoming.length} vendor payment${pendingForUpcoming.length > 1 ? 's' : ''} pending for upcoming events.`,
          actionUrl: '/event-database',
          type: 'warning',
          sound: true,
        });
      } catch (err) {
        console.error(`[Vendor Payment Alert] Failed to notify admin:`, err);
      }
    }

    await logScheduledNotificationSent('vendor_payment_alert', `${pendingForUpcoming.length} vendor payments pending`);
    console.log(`[Vendor Payment Alert] ${pendingForUpcoming.length} vendor payments pending for upcoming events`);
  } catch (error) {
    console.error('[Vendor Payment Alert] Error:', error);
  }
}

async function processLowStockAlerts(): Promise<void> {
  try {
    const now = new Date();
    const currentHour = getISTHour(now);
    const currentMinute = getISTMinute(now);

    if (currentHour !== 8 || currentMinute < 30 || currentMinute > 35) return;
    if (await wasScheduledNotificationSentToday('low_stock_alert')) return;

    const { db } = await import('./db');
    const { inventoryItems } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');

    const allItems = await db.select().from(inventoryItems).where(eq(inventoryItems.isActive, true));

    const lowStockItems = allItems.filter(item => {
      const stock = item.stockQuantity || 0;
      const minLevel = item.minStockLevel || 5;
      return stock <= minLevel;
    });

    if (lowStockItems.length === 0) return;

    const superadmins = await storage.getUsersByRole('superadmin');
    for (const admin of superadmins) {
      try {
        await sendPushToUser(admin.id, {
          title: '📦 Low Stock Alert',
          body: `${lowStockItems.length} inventory item${lowStockItems.length > 1 ? 's are' : ' is'} running low on stock.`,
          actionUrl: '/oak-inventory',
          type: 'warning',
          sound: true,
        });
      } catch (err) {
        console.error(`[Low Stock Alert] Failed to notify admin:`, err);
      }
    }

    await logScheduledNotificationSent('low_stock_alert', `${lowStockItems.length} items low on stock`);
    console.log(`[Low Stock Alert] ${lowStockItems.length} inventory items running low`);
  } catch (error) {
    console.error('[Low Stock Alert] Error:', error);
  }
}

async function processMonthlyPLReport(): Promise<void> {
  try {
    const now = new Date();
    const currentHour = getISTHour(now);
    const currentMinute = getISTMinute(now);
    const todayDate = getISTDate(now);

    const dayOfMonth = parseInt(todayDate.split('-')[2], 10);
    if (dayOfMonth !== 1 || currentHour !== 8 || currentMinute > 5) return;
    if (await wasScheduledNotificationSentToday('monthly_pl_report')) return;

    const lastMonth = new Date(now.getTime());
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthYear = lastMonth.getFullYear();
    const lastMonthNum = lastMonth.getMonth() + 1;
    const lastMonthStart = `${lastMonthYear}-${String(lastMonthNum).padStart(2, '0')}-01`;

    const lastDayOfMonth = new Date(lastMonthYear, lastMonthNum, 0).getDate();
    const lastMonthEnd = `${lastMonthYear}-${String(lastMonthNum).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

    const entries = await storage.getDaybookEntriesByDateRange(lastMonthStart, lastMonthEnd);

    const totalIncome = entries
      .filter((e: any) => e.type === 'income')
      .reduce((sum: number, e: any) => sum + parseFloat(e.amount || '0'), 0);

    const totalExpense = entries
      .filter((e: any) => e.type === 'expense')
      .reduce((sum: number, e: any) => sum + parseFloat(e.amount || '0'), 0);

    const profit = totalIncome - totalExpense;
    const margin = totalIncome > 0 ? Math.round((profit / totalIncome) * 100) : 0;

    const superadmins = await storage.getUsersByRole('superadmin');
    for (const admin of superadmins) {
      try {
        await sendPushToUser(admin.id, {
          title: '📊 Monthly P&L Report',
          body: `Monthly P&L: Income ₹${totalIncome.toLocaleString('en-IN')}, Expenses ₹${totalExpense.toLocaleString('en-IN')}, Profit ₹${profit.toLocaleString('en-IN')} (${margin}%).`,
          actionUrl: '/daybook',
          type: 'info',
          sound: true,
        });
      } catch (err) {
        console.error(`[Monthly P&L] Failed to notify admin:`, err);
      }
    }

    await logScheduledNotificationSent('monthly_pl_report', `Monthly P&L: Income ₹${totalIncome.toLocaleString('en-IN')}, Profit ₹${profit.toLocaleString('en-IN')}`);
    console.log(`[Monthly P&L] Report sent - Income: ₹${totalIncome.toLocaleString('en-IN')}, Profit: ₹${profit.toLocaleString('en-IN')}`);
  } catch (error) {
    console.error('[Monthly P&L] Error:', error);
  }
}

async function processCashflowForecast(): Promise<void> {
  try {
    const now = new Date();
    const currentHour = getISTHour(now);
    const currentMinute = getISTMinute(now);
    const todayDate = getISTDate(now);

    const dayOfMonth = parseInt(todayDate.split('-')[2], 10);
    if (dayOfMonth !== 15 || currentHour !== 9 || currentMinute > 5) return;
    if (await wasScheduledNotificationSentToday('cashflow_forecast')) return;

    const nextMonth = new Date(now.getTime());
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextMonthYear = nextMonth.getFullYear();
    const nextMonthNum = nextMonth.getMonth() + 1;
    const nextMonthStart = `${nextMonthYear}-${String(nextMonthNum).padStart(2, '0')}-01`;
    const lastDayNextMonth = new Date(nextMonthYear, nextMonthNum, 0).getDate();
    const nextMonthEnd = `${nextMonthYear}-${String(nextMonthNum).padStart(2, '0')}-${String(lastDayNextMonth).padStart(2, '0')}`;

    const events = await storage.getAllEvents();
    const nextMonthEvents = events.filter(e => e.date && e.date >= nextMonthStart && e.date <= nextMonthEnd);
    const expectedCollections = nextMonthEvents.reduce((sum, e) => {
      const salesValue = parseFloat(e.salesValue?.toString() || '0');
      const received = parseFloat(e.paymentReceived?.toString() || '0');
      return sum + Math.max(0, salesValue - received);
    }, 0);

    let avgMonthlyExpense = 0;
    for (let i = 1; i <= 3; i++) {
      const pastMonth = new Date(now.getTime());
      pastMonth.setMonth(pastMonth.getMonth() - i);
      const pmYear = pastMonth.getFullYear();
      const pmNum = pastMonth.getMonth() + 1;
      const pmStart = `${pmYear}-${String(pmNum).padStart(2, '0')}-01`;
      const pmLastDay = new Date(pmYear, pmNum, 0).getDate();
      const pmEnd = `${pmYear}-${String(pmNum).padStart(2, '0')}-${String(pmLastDay).padStart(2, '0')}`;

      const entries = await storage.getDaybookEntriesByDateRange(pmStart, pmEnd);
      const monthExpense = entries
        .filter((e: any) => e.type === 'expense')
        .reduce((sum: number, e: any) => sum + parseFloat(e.amount || '0'), 0);
      avgMonthlyExpense += monthExpense;
    }
    avgMonthlyExpense = Math.round(avgMonthlyExpense / 3);

    const banks = await storage.getAllBanks();
    const currentCash = banks.reduce((sum, b) => sum + parseFloat(b.balance?.toString() || '0'), 0);

    const netPosition = expectedCollections - avgMonthlyExpense;

    const superadmins = await storage.getUsersByRole('superadmin');
    for (const admin of superadmins) {
      try {
        await sendPushToUser(admin.id, {
          title: '💵 Cashflow Forecast',
          body: `Cashflow Forecast: Expected collections ₹${expectedCollections.toLocaleString('en-IN')}, Estimated expenses ₹${avgMonthlyExpense.toLocaleString('en-IN')}, Net position ₹${netPosition.toLocaleString('en-IN')}.`,
          actionUrl: '/daybook',
          type: 'info',
          sound: true,
        });
      } catch (err) {
        console.error(`[Cashflow Forecast] Failed to notify admin:`, err);
      }
    }

    await logScheduledNotificationSent('cashflow_forecast', `Cashflow: Collections ₹${expectedCollections.toLocaleString('en-IN')}, Net ₹${netPosition.toLocaleString('en-IN')}`);
    console.log(`[Cashflow Forecast] Sent - Collections: ₹${expectedCollections.toLocaleString('en-IN')}, Net: ₹${netPosition.toLocaleString('en-IN')}`);
  } catch (error) {
    console.error('[Cashflow Forecast] Error:', error);
  }
}

async function processPipelineHealthAlert(): Promise<void> {
  try {
    const now = new Date();
    const currentHour = getISTHour(now);
    const currentMinute = getISTMinute(now);

    const dayOfWeek = parseInt(formatInTimeZone(now, INDIA_TIMEZONE, 'i'), 10);
    if (dayOfWeek !== 1 || currentHour !== 9 || currentMinute > 5) return;
    if (await wasScheduledNotificationSentToday('pipeline_health_alert')) return;

    const { db } = await import('./db');
    const { salesDeals } = await import('@shared/schema');

    const todayDate = getISTDate(now);
    const monthStart = todayDate.substring(0, 7) + '-01';

    const allDeals = await db.select().from(salesDeals);

    const thisMonthDeals = allDeals.filter(d => {
      const createdDate = d.createdAt ? getISTDate(new Date(d.createdAt)) : '';
      return createdDate >= monthStart && createdDate <= todayDate;
    });

    const totalLeads = thisMonthDeals.length;
    const wonDeals = thisMonthDeals.filter(d => d.status === 'won').length;
    const conversionRate = totalLeads > 0 ? Math.round((wonDeals / totalLeads) * 100) : 0;

    const pipelineValue = allDeals
      .filter(d => d.status === 'open')
      .reduce((sum, d) => sum + parseFloat(d.value?.toString() || '0'), 0);

    if (conversionRate < 15) {
      const superadmins = await storage.getUsersByRole('superadmin');
      for (const admin of superadmins) {
        try {
          await sendPushToUser(admin.id, {
            title: '📉 Pipeline Health Alert',
            body: `Pipeline Alert: ${totalLeads} leads this month, ${conversionRate}% conversion rate (below 15% target). Pipeline value: ₹${pipelineValue.toLocaleString('en-IN')}.`,
            actionUrl: '/oak-sales',
            type: 'warning',
            sound: true,
          });
        } catch (err) {
          console.error(`[Pipeline Health] Failed to notify admin:`, err);
        }
      }
    }

    await logScheduledNotificationSent('pipeline_health_alert', `Pipeline: ${totalLeads} leads, ${conversionRate}% conversion, ₹${pipelineValue.toLocaleString('en-IN')} value`);
    console.log(`[Pipeline Health] Weekly report - ${totalLeads} leads, ${conversionRate}% conversion`);
  } catch (error) {
    console.error('[Pipeline Health] Error:', error);
  }
}

async function processBudgetPlanReminders(): Promise<void> {
  try {
    const now = new Date();
    const currentHour = getISTHour(now);
    if (currentHour !== 9) return;

    if (await wasScheduledNotificationSentToday('budget_plan_reminder')) return;

    const entries = await storage.getDueBudgetPlanEntries(7);
    if (entries.length === 0) return;

    const { db } = await import('./db');
    const { users } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');

    const superadmins = await db.select().from(users).where(eq(users.role, 'superadmin'));

    let message = `${entries.length} budget plan entries need attention:\n`;
    entries.slice(0, 5).forEach(e => {
      message += `• ${e.category}: ₹${parseFloat(String(e.estimatedAmount || '0')).toLocaleString('en-IN')}\n`;
    });

    for (const admin of superadmins) {
      try {
        await sendPushToUser(admin.id, {
          title: '💰 Budget Plan Reminder',
          body: message.trim(),
          actionUrl: '/oak-book?section=budget-plan',
          type: 'info',
          sound: true,
        });
      } catch (err) {
        console.error(`[Budget Plan] Failed to notify admin:`, err);
      }
    }

    await logScheduledNotificationSent('budget_plan_reminder', `${entries.length} budget plan entries reminded`);
    console.log(`[Budget Plan] Sent reminders for ${entries.length} upcoming payments`);
  } catch (error) {
    console.error('[Budget Plan Reminders] Error:', error);
  }
}

async function processCashflowPaymentNotifications(): Promise<void> {
  const hour = getISTHour();
  if (hour !== 9) return;

  try {
    const logs = await storage.getNotificationLogsByType('cashflow_payment');
    if (logs.length > 0) {
      const todayIST = getISTDate(new Date());
      const lastLogDate = getISTDate(new Date(logs[0].createdAt || ''));
      if (lastLogDate === todayIST) return;
    }
  } catch (e) { /* continue if check fails */ }

  try {
    const today = getISTDate();
    const tomorrow = new Date(new Date(today).getTime() + 86400000).toISOString().split('T')[0];
    const currentMonth = today.substring(0, 7);

    const allEntries = await db.select().from(cashflowEntries)
      .where(and(
        eq(cashflowEntries.isPaid, false),
        eq(cashflowEntries.month, currentMonth)
      ));

    const unpaidLiabilities = await db.select().from(liabilities)
      .where(eq(liabilities.isPaid, false));

    const overdue = allEntries.filter(e => e.dueDate && e.dueDate < today);
    const dueToday = allEntries.filter(e => e.dueDate === today);
    const dueTomorrow = allEntries.filter(e => e.dueDate === tomorrow);
    const upcoming = [...overdue, ...dueToday, ...dueTomorrow];

    if (upcoming.length === 0 && unpaidLiabilities.length === 0) return;

    const expenses = allEntries.filter(e => e.type === 'expense');
    const inflows = allEntries.filter(e => e.type === 'inflow');
    const totalExpenses = expenses.reduce((s, e) => s + parseFloat(e.amount || '0'), 0);
    const totalInflows = inflows.reduce((s, e) => s + parseFloat(e.amount || '0'), 0);
    const totalLiabilities = unpaidLiabilities.reduce((s, l) => s + parseFloat(l.amount || '0'), 0);

    let message = `💰 *Cashflow Alert - ${format(new Date(today), 'dd MMM yyyy')}*\n\n`;

    if (overdue.length > 0) {
      message += `🔴 *OVERDUE (${overdue.length}):*\n`;
      overdue.forEach(e => {
        message += `  • ${e.name}: ₹${parseFloat(e.amount || '0').toLocaleString('en-IN')} (due ${e.dueDate})\n`;
      });
      message += '\n';
    }

    if (dueToday.length > 0) {
      message += `🟡 *DUE TODAY (${dueToday.length}):*\n`;
      dueToday.forEach(e => {
        message += `  • ${e.name}: ₹${parseFloat(e.amount || '0').toLocaleString('en-IN')}\n`;
      });
      message += '\n';
    }

    if (dueTomorrow.length > 0) {
      message += `🔵 *DUE TOMORROW (${dueTomorrow.length}):*\n`;
      dueTomorrow.forEach(e => {
        message += `  • ${e.name}: ₹${parseFloat(e.amount || '0').toLocaleString('en-IN')}\n`;
      });
      message += '\n';
    }

    message += `📊 *Monthly Summary:*\n`;
    message += `  Expected In: ₹${totalInflows.toLocaleString('en-IN')}\n`;
    message += `  Expected Out: ₹${totalExpenses.toLocaleString('en-IN')}\n`;
    if (totalLiabilities > 0) {
      message += `  Unpaid Liabilities: ₹${totalLiabilities.toLocaleString('en-IN')}\n`;
    }

    const allUsers = await storage.getAllUsers();
    const superadmins = allUsers.filter(u => u.role === 'superadmin');

    for (const admin of superadmins) {
      try {
        await sendPushToUser(admin.id, {
          title: `💰 Cashflow Alert: ${overdue.length} overdue, ${dueToday.length} due today`,
          body: `Total pending expenses: ₹${totalExpenses.toLocaleString('en-IN')}. Expected inflows: ₹${totalInflows.toLocaleString('en-IN')}`,
          data: { url: '/management-mis' }
        });
      } catch (e) {
        console.error(`[Cashflow Notification] Push failed for ${admin.name}:`, e);
      }
    }

    await logScheduledNotificationSent('cashflow_payment' as any, message.substring(0, 200));
    console.log(`[Cashflow Notification] Sent daily cashflow alert: ${overdue.length} overdue, ${dueToday.length} due today, ${dueTomorrow.length} due tomorrow`);
  } catch (error) {
    console.error('[Cashflow Notification] Error:', error);
  }
}

async function processMonthlyRecurringGeneration(): Promise<void> {
  const hour = getISTHour();
  const dayOfMonth = parseInt(formatInTimeZone(new Date(), INDIA_TIMEZONE, 'd'), 10);
  if (hour !== 0 || dayOfMonth !== 1) return;

  try {
    const now = new Date();
    const currentMonth = formatInTimeZone(now, INDIA_TIMEZONE, 'yyyy-MM');

    const existingThisMonth = await db.select().from(cashflowEntries)
      .where(eq(cashflowEntries.month, currentMonth));

    if (existingThisMonth.length > 0) return;

    const [year, mon] = currentMonth.split('-').map(Number);
    const prevMonth = mon === 1
      ? `${year - 1}-12`
      : `${year}-${String(mon - 1).padStart(2, '0')}`;

    const recurringEntries = await db.select().from(cashflowEntries)
      .where(and(
        eq(cashflowEntries.isRecurring, true),
        eq(cashflowEntries.recurringActive, true),
        eq(cashflowEntries.month, prevMonth)
      ));

    let created = 0;
    for (const entry of recurringEntries) {
      const parentRef = entry.parentId || entry.id;
      const newDueDate = entry.dueDate
        ? (() => {
            const d = new Date(entry.dueDate);
            d.setMonth(d.getMonth() + 1);
            return d.toISOString().split('T')[0];
          })()
        : null;

      await db.insert(cashflowEntries).values({
        type: entry.type,
        name: entry.name,
        description: entry.description,
        amount: entry.amount,
        dueDate: newDueDate,
        month: currentMonth,
        isRecurring: true,
        recurringActive: true,
        parentId: parentRef,
        isPaid: false,
        category: entry.category,
        createdBy: entry.createdBy,
      });
      created++;
    }

    if (created > 0) {
      console.log(`[Recurring Generation] Auto-generated ${created} recurring entries for ${currentMonth}`);
    }
  } catch (error) {
    console.error('[Recurring Generation] Error:', error);
  }
}

async function processMonthlyAttendanceSummary(): Promise<void> {
  try {
    const now = new Date();
    const currentHour = getISTHour(now);
    const currentMinute = getISTMinute(now);
    const todayDate = getISTDate(now);

    const dayOfMonth = parseInt(todayDate.split('-')[2], 10);
    if (dayOfMonth !== 1 || currentHour !== 10 || currentMinute > 5) return;
    if (await wasScheduledNotificationSentToday('monthly_attendance_summary')) return;

    const lastMonth = new Date(now.getTime());
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthYear = lastMonth.getFullYear();
    const lastMonthNum = lastMonth.getMonth() + 1;

    const { db } = await import('./db');
    const { employeeAttendance, leaveRequests, leaveCategories, employees } = await import('@shared/schema');
    const { eq, and, gte, lte } = await import('drizzle-orm');
    const { getDaysInMonth, getDay } = await import('date-fns');

    const activeEmployees = (await db.select().from(employees).where(eq(employees.isActive, true)));
    const daysInMonth = getDaysInMonth(new Date(lastMonthYear, lastMonthNum - 1));
    let sundaysCount = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      if (getDay(new Date(lastMonthYear, lastMonthNum - 1, d)) === 0) sundaysCount++;
    }
    const totalWorkingDays = daysInMonth - sundaysCount;

    const startDate = `${lastMonthYear}-${String(lastMonthNum).padStart(2, '0')}-01`;
    const endDate = `${lastMonthYear}-${String(lastMonthNum).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    const allAttendance = await db.select().from(employeeAttendance)
      .where(and(gte(employeeAttendance.date, startDate), lte(employeeAttendance.date, endDate)));

    const allLeaves = await db.select({
      id: leaveRequests.id, employeeId: leaveRequests.employeeId,
      startDate: leaveRequests.startDate, endDate: leaveRequests.endDate,
      leaveType: leaveRequests.leaveType, categoryId: leaveRequests.categoryId,
    }).from(leaveRequests)
      .where(and(eq(leaveRequests.status, 'approved'), lte(leaveRequests.startDate, endDate), gte(leaveRequests.endDate, startDate)));

    const cats = await db.select().from(leaveCategories);
    const catMap = new Map(cats.map(c => [c.id, c.name]));

    let count = 0;
    for (const emp of activeEmployees) {
      const empAtt = allAttendance.filter(a => a.employeeId === emp.id);
      const daysPresent = empAtt.length;
      const totalHoursWorked = empAtt.reduce((sum, a) => sum + (parseFloat(a.totalHours || '0') || 0), 0);
      const avgHours = daysPresent > 0 ? totalHoursWorked / daysPresent : 0;

      let casualLeaves = 0, sickLeaves = 0, otherLeaves = 0;
      const empLeaves = allLeaves.filter(l => l.employeeId === emp.id);
      for (const leave of empLeaves) {
        const ls = new Date(leave.startDate), le = new Date(leave.endDate);
        const ms = new Date(lastMonthYear, lastMonthNum - 1, 1), me = new Date(lastMonthYear, lastMonthNum - 1, daysInMonth);
        const es = ls < ms ? ms : ls, ee = le > me ? me : le;
        let days = 0;
        for (let d = new Date(es); d <= ee; d.setDate(d.getDate() + 1)) { if (getDay(d) !== 0) days++; }
        const typeName = (leave.categoryId ? catMap.get(leave.categoryId) : leave.leaveType || '').toLowerCase();
        if (typeName.includes('casual')) casualLeaves += days;
        else if (typeName.includes('sick')) sickLeaves += days;
        else otherLeaves += days;
      }

      const totalLeaves = casualLeaves + sickLeaves + otherLeaves;
      const daysAbsent = Math.max(0, totalWorkingDays - daysPresent - totalLeaves);

      await storage.upsertMonthlyAttendanceSummary({
        employeeId: emp.id, month: lastMonthNum, year: lastMonthYear,
        totalWorkingDays, daysPresent, daysAbsent,
        casualLeaves, sickLeaves, otherLeaves, totalLeaves,
        totalHoursWorked: totalHoursWorked.toFixed(2), avgHoursPerDay: avgHours.toFixed(2),
        lateCheckIns: 0, sundaysInMonth: sundaysCount,
      });
      count++;
    }

    await logScheduledNotificationSent('monthly_attendance_summary', `Monthly attendance summary calculated for ${count} employees for ${lastMonthNum}/${lastMonthYear}`);
    console.log(`[Monthly Attendance Summary] Calculated for ${count} employees for ${lastMonthNum}/${lastMonthYear}`);
  } catch (error) {
    console.error('[Monthly Attendance Summary] Error:', error);
  }
}

async function runAllScheduledTasks(): Promise<void> {
  try { await processReminders(); } catch (e) { console.error('[Scheduler] processReminders failed:', e); }
  try { await process60DayPaymentReminders(); } catch (e) { console.error('[Scheduler] process60DayPaymentReminders failed:', e); }
  try { await processRsvpReminders(); } catch (e) { console.error('[Scheduler] processRsvpReminders failed:', e); }
  try { await processPortalLeadReminders(); } catch (e) { console.error('[Scheduler] processPortalLeadReminders failed:', e); }
  try { await sendMorningBusinessReport(); } catch (e) { console.error('[Scheduler] sendMorningBusinessReport failed:', e); }
  try { await sendNightReminderSummary(); } catch (e) { console.error('[Scheduler] sendNightReminderSummary failed:', e); }
  try { await processAttendanceReminders(); } catch (e) { console.error('[Scheduler] processAttendanceReminders failed:', e); }
  try { await processStaleSalesLeadReminders(); } catch (e) { console.error('[Scheduler] processStaleSalesLeadReminders failed:', e); }
  try { await processBudgetAlerts(); } catch (e) { console.error('[Scheduler] processBudgetAlerts failed:', e); }
  try { await processPreEventReminders(); } catch (e) { console.error('[Scheduler] processPreEventReminders failed:', e); }
  try { await processPostEventActions(); } catch (e) { console.error('[Scheduler] processPostEventActions failed:', e); }
  try { await processVendorPaymentAlerts(); } catch (e) { console.error('[Scheduler] processVendorPaymentAlerts failed:', e); }
  try { await processLowStockAlerts(); } catch (e) { console.error('[Scheduler] processLowStockAlerts failed:', e); }
  try { await processMonthlyPLReport(); } catch (e) { console.error('[Scheduler] processMonthlyPLReport failed:', e); }
  try { await processCashflowForecast(); } catch (e) { console.error('[Scheduler] processCashflowForecast failed:', e); }
  try { await processPipelineHealthAlert(); } catch (e) { console.error('[Scheduler] processPipelineHealthAlert failed:', e); }
  try { await processBudgetPlanReminders(); } catch (e) { console.error('[Scheduler] processBudgetPlanReminders failed:', e); }
  try { await processConfigurableRsvpReminders(); } catch (e) { console.error('[Scheduler] processConfigurableRsvpReminders failed:', e); }
  try { await processCashflowPaymentNotifications(); } catch (e) { console.error('[Scheduler] processCashflowPaymentNotifications failed:', e); }
  try { await processMonthlyRecurringGeneration(); } catch (e) { console.error('[Scheduler] processMonthlyRecurringGeneration failed:', e); }
  try { await processMonthlyAttendanceSummary(); } catch (e) { console.error('[Scheduler] processMonthlyAttendanceSummary failed:', e); }
}

export function startReminderScheduler(): void {
  if (schedulerInterval) {
    console.log('[Reminder Scheduler] Scheduler already running');
    return;
  }

  console.log('[Reminder Scheduler] Starting reminder scheduler (checks every 60 seconds)');
  
  runAllScheduledTasks();
  
  schedulerInterval = setInterval(runAllScheduledTasks, 60 * 1000);
}

export function stopReminderScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[Reminder Scheduler] Scheduler stopped');
  }
}
