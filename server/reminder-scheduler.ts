import { storage } from "./storage";
import { sendWhatsAppMessage } from "./whatsapp-service";

let schedulerInterval: NodeJS.Timeout | null = null;

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
        
        await sendWhatsAppMessage(reminder.employeePhone, message);
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
        
        await sendWhatsAppMessage(plannerPhone, message);
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

async function runAllScheduledTasks(): Promise<void> {
  await processReminders();
  await process60DayPaymentReminders();
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
