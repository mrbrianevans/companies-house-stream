
self.addEventListener('install', () => {
  self.skipWaiting();
});


self.addEventListener('activate', () => {
  self.clients.matchAll({
    type: 'window'
  }).then(windowClients => {
    windowClients.forEach((windowClient) => {
      windowClient.navigate(windowClient.url);
    });
  });
});

self.addEventListener('fetch', (e) => {
  e.respondWith((async () => {
    try{
      console.debug(`[Service Worker] Fetching resource: ${e.request.url}`)
      const response = await fetch(e.request)
      return response
    }catch (e) {
      return new Response(null, {status: 400, statusText: 'Offline'})
    }
  })());
});
