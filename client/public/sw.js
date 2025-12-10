const CACHE_NAME = 'oak-street-quick-entry-v1';

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (event.request.method === 'POST' && url.pathname === '/quick-entry-share') {
    console.log('[SW] Handling share target request');
    event.respondWith(handleSharedScreenshot(event.request));
  }
});

async function handleSharedScreenshot(request) {
  try {
    console.log('[SW] Processing shared screenshot...');
    const formData = await request.formData();
    const screenshot = formData.get('screenshot');
    
    if (screenshot) {
      console.log('[SW] Screenshot received:', screenshot.name, screenshot.type, screenshot.size);
      const cache = await caches.open(CACHE_NAME);
      
      const blob = await screenshot.arrayBuffer();
      const response = new Response(blob, {
        headers: {
          'Content-Type': screenshot.type || 'image/jpeg',
          'X-Filename': screenshot.name || 'screenshot.jpg'
        }
      });
      await cache.put('shared-screenshot', response);
      console.log('[SW] Screenshot saved to cache');
      
      const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      console.log('[SW] Found clients:', allClients.length);
      allClients.forEach(client => {
        client.postMessage({
          type: 'shared-screenshot',
          filename: screenshot.name || 'screenshot.jpg'
        });
      });
    } else {
      console.log('[SW] No screenshot found in form data');
    }
    
    return Response.redirect('/employee-portal?share-target=quick-entry&t=' + Date.now(), 303);
  } catch (error) {
    console.error('[SW] Error handling shared screenshot:', error);
    return Response.redirect('/employee-portal?share-error=true&msg=' + encodeURIComponent(error.message), 303);
  }
}
