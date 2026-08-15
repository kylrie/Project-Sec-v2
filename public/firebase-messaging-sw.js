// =============================================================================
// PROJECT AHRI / FRIDAY: FIREBASE MESSAGING SERVICE WORKER
// =============================================================================
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Dynamically fetch Firebase public configuration from the server
fetch('/api/config/firebase')
  .then((res) => {
    if (!res.ok) throw new Error('No dynamic firebase config available');
    return res.json();
  })
  .then((config) => {
    if (!config || !config.apiKey) return;
    firebase.initializeApp(config);
    const messaging = firebase.messaging();

    // Background Message Handler
    messaging.onBackgroundMessage((payload) => {
      console.log('[SW] Background notification received:', payload);

      const title = payload.notification?.title || payload.data?.title || 'Project Ahri Alert';
      const options = {
        body: payload.notification?.body || payload.data?.body || 'New executive briefing available.',
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        data: {
          url: payload.data?.click_action || payload.data?.url || '/'
        }
      };

      self.registration.showNotification(title, options);
    });
  })
  .catch((err) => {
    console.log('[SW] Firebase messaging SW idle (dynamic config unavailable):', err.message);
  });

// Notification Click Handler: Focus existing app or open target URL
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
