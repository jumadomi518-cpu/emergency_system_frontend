
// Listen for push events
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();

  const options = {
    body: data.body,
    icon: '../assets/emergency.png',
    badge: '../assets/emergency.png',
    data: {
      url: data.url, 
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});


self.addEventListener('notificationclick', (event) => {
  event.notification.close(); 

  const urlToOpen = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});