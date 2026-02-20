// Install & Activate
self.addEventListener('install', event => {
  console.log('[SW] Installed');
  self.skipWaiting(); // Activate immediately
});

self.addEventListener('activate', event => {
  console.log('[SW] Activated');
  self.clients.claim(); 
});

//  Listen to Push Events
self.addEventListener('push', event => {
  console.log('[SW] Push received');
  
  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    console.error('[SW] Push data parse error', e);
    return;
  }

  const title = data.title || 'Emergency Alert';
  const body = data.body || 'You have a new emergency.';
  const url = data.data?.url || '/';

  const options = {
    body: body,
    icon: '/assets/emergency-icon.png',
    badge: '/assets/emergency-badge.png',
    data: { url },
    vibrate: [200, 100, 200],
    tag: `alert-${data.data?.alertId || Date.now()}`,
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle Notification Click
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Focus if already open
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      // Otherwise, open new tab/window
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

