

self.addEventListener("install", (event) => {
  console.log("Service Worker installed");
  self.skipWaiting();
});


self.addEventListener("activate", (event) => {
  console.log("Service Worker activated");
  event.waitUntil(self.clients.claim());
});


self.addEventListener("push", (event) => {
  console.log("Push event received");

  if (!event.data) {
    console.log("No payload received");
    return;
  }

  let data = {};

  try {
    data = event.data.json();
  } catch (err) {
    console.error("Push data not JSON:", err);
    data = {
      title: "Emergency Alert",
      body: event.data.text()
    };
  }

  const options = {
    body: data.body || "New emergency notification",
    icon: "/assets/emergency.png",
    badge: "/assets/emergency.png",
    vibrate: [300, 100, 300, 100, 500],
    requireInteraction: true,
    data: {
      url: data.url || "https://yourdomain.com/"
    }
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || "Emergency System",
      options
    )
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url;

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then((clientList) => {

      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && "focus" in client) {
          return client.focus();
        }
      }


      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
