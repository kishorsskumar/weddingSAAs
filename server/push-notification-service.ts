import webPush from 'web-push';
import { storage } from './storage';

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

if (vapidPublicKey && vapidPrivateKey) {
  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  console.log('[Push] VAPID keys configured successfully');
} else {
  console.warn('[Push] VAPID keys not configured - push notifications disabled');
}

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  actionUrl?: string;
  notificationId?: string;
  type?: string;
  sound?: boolean;
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('[Push] VAPID not configured, skipping push');
    return 0;
  }

  const subscriptions = await storage.getPushSubscriptionsByUser(userId);
  if (subscriptions.length === 0) {
    console.log(`[Push] No subscriptions for user ${userId}`);
    return 0;
  }

  let sent = 0;
  for (const sub of subscriptions) {
    try {
      await webPush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dhKey,
            auth: sub.authKey,
          },
        },
        JSON.stringify({
          ...payload,
          icon: payload.icon || '/oak-street-pwa-icon.jpg',
          badge: payload.badge || '/oak-street-logo.png',
        }),
        { TTL: 60 * 60 }
      );
      sent++;
      console.log(`[Push] Sent to user ${userId} (endpoint: ${sub.endpoint.slice(0, 50)}...)`);
    } catch (error: any) {
      if (error.statusCode === 410 || error.statusCode === 404) {
        console.log(`[Push] Subscription expired, removing: ${sub.id}`);
        await storage.deletePushSubscription(sub.id);
      } else {
        console.error(`[Push] Failed to send to user ${userId}:`, error.message);
      }
    }
  }
  return sent;
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<number> {
  let totalSent = 0;
  for (const userId of userIds) {
    totalSent += await sendPushToUser(userId, payload);
  }
  return totalSent;
}

export async function sendPushToAll(payload: PushPayload): Promise<number> {
  if (!vapidPublicKey || !vapidPrivateKey) return 0;

  const allSubs = await storage.getAllPushSubscriptions();
  let sent = 0;
  for (const sub of allSubs) {
    try {
      await webPush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dhKey,
            auth: sub.authKey,
          },
        },
        JSON.stringify({
          ...payload,
          icon: payload.icon || '/oak-street-pwa-icon.jpg',
          badge: payload.badge || '/oak-street-logo.png',
        }),
        { TTL: 60 * 60 }
      );
      sent++;
    } catch (error: any) {
      if (error.statusCode === 410 || error.statusCode === 404) {
        await storage.deletePushSubscription(sub.id);
      }
    }
  }
  return sent;
}

export async function sendOaksyNotification(
  userId: string,
  userName: string,
  message: string,
  actionUrl?: string,
  type: string = 'info'
): Promise<void> {
  const notification = await storage.createNotification({
    title: `Oaksy`,
    message: `${userName}, ${message}`,
    type,
    actionUrl,
    audienceType: 'individual',
    audienceUserIds: [userId],
    createdBy: null,
  });

  await storage.createNotificationRecipients(notification.id, [userId]);

  await sendPushToUser(userId, {
    title: 'AI Assistant',
    body: `${userName}, ${message}`,
    actionUrl,
    notificationId: notification.id,
    type,
    sound: true,
  });
}

export async function notifyNewLeadAssigned(
  plannerId: string,
  plannerName: string,
  leadName: string,
  leadPhone: string
): Promise<void> {
  await sendOaksyNotification(
    plannerId,
    plannerName,
    `you have a new lead! 🎉 ${leadName} (${leadPhone}) has been assigned to you. Check your pipeline now!`,
    '/oak-sales',
    'success'
  );
}

export async function notifyStaffAssigned(
  staffUserId: string,
  staffName: string,
  eventName: string,
  eventDate: string,
  role: string
): Promise<void> {
  await sendOaksyNotification(
    staffUserId,
    staffName,
    `you've been assigned to "${eventName}" on ${eventDate} as ${role}. Check your schedule!`,
    '/events',
    'info'
  );
}

export async function notifyLeaveApproval(
  userId: string,
  userName: string,
  status: string,
  dates: string
): Promise<void> {
  const statusText = status === 'approved' ? 'approved ✅' : 'declined ❌';
  await sendOaksyNotification(
    userId,
    userName,
    `your leave request for ${dates} has been ${statusText}.`,
    '/hr',
    status === 'approved' ? 'success' : 'warning'
  );
}

export async function notifyExpenseApproval(
  userId: string,
  userName: string,
  amount: string,
  status: string
): Promise<void> {
  const statusText = status === 'approved' ? 'approved ✅' : 'declined ❌';
  await sendOaksyNotification(
    userId,
    userName,
    `your expense request of ₹${amount} has been ${statusText}.`,
    '/daybook',
    status === 'approved' ? 'success' : 'warning'
  );
}

export async function notifyNewLeadToSuperadmins(
  leadName: string,
  leadPhone: string,
  eventType: string,
  source: 'portal' | 'manual' | 'crm'
): Promise<void> {
  try {
    const superadmins = await storage.getUsersByRole('superadmin');
    const sourceLabel = source === 'portal' ? 'Client Portal' : source === 'manual' ? 'Manual Entry' : 'CRM Pipeline';
    for (const admin of superadmins) {
      await sendOaksyNotification(
        admin.id,
        admin.name || 'Admin',
        `new lead received! 📋 ${leadName} (${leadPhone}) via ${sourceLabel}${eventType ? ` - ${eventType}` : ''}. Check Oak Sales for details.`,
        '/oak-sales',
        'success'
      );
    }
  } catch (error) {
    console.error('[Push] Failed to notify superadmins about new lead:', error);
  }
}
