// =============================================================================
// PROJECT AHRI / FRIDAY: FIREBASE MESSAGING SERVICE WORKER
// =============================================================================
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyCKLXCdAsPlU7TFR7yFlTOL7mKMnsspvow",
  authDomain: "gen-lang-client-0699733118.firebaseapp.com",
  projectId: "gen-lang-client-0699733118",
  storageBucket: "gen-lang-client-0699733118.firebasestorage.app",
  messagingSenderId: "189100351312",
  appId: "1:189100351312:web:1ea04173d96d62d2909655"
};

firebase.initializeApp(firebaseConfig);
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
