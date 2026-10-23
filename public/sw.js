// Importar SDK de OneSignal para Push Notifications en segundo plano
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

// Limpieza de cualquier caché antigua heredada
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => cacheName === 'caec-tenis-v1')
          .map((cacheName) => caches.delete(cacheName))
      );
    })
  );
});
