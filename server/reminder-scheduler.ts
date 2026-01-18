import { storage } from "./storage";
import { sendWhatsAppMessage } from "./whatsapp-service";

let schedulerInterval: NodeJS.Timeout | null = null;

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

export function startReminderScheduler(): void {
  if (schedulerInterval) {
    console.log('[Reminder Scheduler] Scheduler already running');
    return;
  }

  console.log('[Reminder Scheduler] Starting reminder scheduler (checks every 60 seconds)');
  
  processReminders();
  
  schedulerInterval = setInterval(processReminders, 60 * 1000);
}

export function stopReminderScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[Reminder Scheduler] Scheduler stopped');
  }
}
