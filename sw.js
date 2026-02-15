// Listen for push notifications
self.addEventListener("push", event => {
  const data = event.data ? event.data.json() : {};

  const options = {
    body: data.message || "An emergency has occurred near you. Please confirm.",
    icon: "../assets/alert-icon.png",
    badge: "../assets/badge.png",
    vibrate: [250, 100, 250],
    data: { alertId: data.alertId },
    actions: [
      { action: "true", title: "True" },
      { action: "false", title: "False" }
    ]
  };

  event.waitUntil(
    self.registration.showNotification("Mbiu emergency Alert", options)
  );
});

// Handle notification clicks
self.addEventListener("notificationclick", event => {
  const alertId = event.notification.data.alertId;
  let vote = null;

  if (event.action === "true") vote = true;
  else if (event.action === "false") vote = false;
  else vote = confirm("Was this emergency true? OK = True, Cancel = False");

  event.notification.close();

  if (vote !== null) {
    event.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: true })
        .then(windowClients => {
          // send vote to all open tabs
          windowClients.forEach(client => {
            client.postMessage({ type: "VALIDATE_RESPONSE", alertId, vote });
          });
        })
    );
  }
});
