let vapidPublicKey: string | null = null;

async function getVapidKey(): Promise<string | null> {
  if (vapidPublicKey) return vapidPublicKey;
  try {
    const res = await fetch('/api/push/vapid-key');
    if (!res.ok) return null;
    const data = await res.json();
    vapidPublicKey = data.publicKey || null;
    return vapidPublicKey;
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerPushSubscription(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('[Push] Push notifications not supported');
      return false;
    }

    const currentPermission = Notification.permission;
    if (currentPermission === 'denied') {
      console.log('[Push] Permission previously denied');
      return false;
    }

    const registration = await navigator.serviceWorker.ready;

    const existingSubscription = await registration.pushManager.getSubscription();

    if (existingSubscription) {
      const subscriptionJson = existingSubscription.toJSON();
      await sendSubscriptionToServer(existingSubscription.endpoint, subscriptionJson.keys);
      console.log('[Push] Existing subscription registered with server');
      return true;
    }

    if (currentPermission === 'granted') {
      return await subscribeToPush(registration);
    }

    console.log('[Push] Permission not yet granted, will prompt when user interacts');
    return false;
  } catch (error) {
    console.error('[Push] Error registering subscription:', error);
    return false;
  }
}

export async function requestPushPermission(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return false;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    return await subscribeToPush(registration);
  } catch (error) {
    console.error('[Push] Error requesting permission:', error);
    return false;
  }
}

async function subscribeToPush(registration: ServiceWorkerRegistration): Promise<boolean> {
  try {
    const key = await getVapidKey();
    if (!key) {
      console.error('[Push] No VAPID public key available');
      return false;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });

    const subscriptionJson = subscription.toJSON();
    await sendSubscriptionToServer(subscription.endpoint, subscriptionJson.keys);
    console.log('[Push] Successfully subscribed to push notifications');
    return true;
  } catch (error) {
    console.error('[Push] Failed to subscribe:', error);
    return false;
  }
}

async function sendSubscriptionToServer(
  endpoint: string,
  keys: { p256dh?: string; auth?: string } | undefined
): Promise<void> {
  if (!keys?.p256dh || !keys?.auth) {
    console.warn('[Push] Missing subscription keys');
    return;
  }

  await fetch('/api/push-subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      endpoint,
      keys: {
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      userAgent: navigator.userAgent,
    }),
  });
}

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function getPushPermissionStatus(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}
