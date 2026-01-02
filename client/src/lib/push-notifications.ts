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

    if (currentPermission !== 'granted') {
      console.log('[Push] Permission not yet granted, will prompt when user interacts');
      return false;
    }

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

    return true;
  } catch (error) {
    console.error('[Push] Error requesting permission:', error);
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
