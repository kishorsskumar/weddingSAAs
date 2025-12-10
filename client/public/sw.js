const CACHE_NAME = 'oak-street-quick-entry-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (event.request.method === 'POST' && url.pathname === '/quick-entry-share') {
    event.respondWith(handleSharedScreenshot(event.request));
  }
});

async function handleSharedScreenshot(request) {
  try {
    const formData = await request.formData();
    const screenshot = formData.get('screenshot');
    
    if (screenshot) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put('shared-screenshot', new Response(screenshot));
      
      const allClients = await clients.matchAll({ type: 'window' });
      allClients.forEach(client => {
        client.postMessage({
          type: 'shared-screenshot',
          filename: screenshot.name
        });
      });
    }
    
    return Response.redirect('/employee-portal?share-target=quick-entry', 303);
  } catch (error) {
    console.error('Error handling shared screenshot:', error);
    return Response.redirect('/employee-portal?share-error=true', 303);
  }
}
