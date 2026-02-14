// Listen for push notifications

self.addEventListener("push", event => {
  const data = event.data ? event.data.json() : {};

  const options = {
    body: data.message || "An emergency occurred nearby. Please confirm.",
    icon: "../assets/alert-icon.png",
    badge: "../assets/badge.png",
    vibrate: [200, 100, 200],
    data: { alertId: data.alertId },
    actions: [
      { action: "true", title: "True" },
      { action: "false", title: "False" }
    ]
  };

  event.waitUntil(
    self.registration.showNotification("Emergency Alert!", options)
  );
});


// Handle notification clicks
self.addEventListener("notificationclick", event => {
  const alertId = event.notification.data.alertId;
  let vote = null;

  if (event.action === "true") vote = true;
  if (event.action === "false") vote = false;

  event.notification.close();

  if (vote !== null) {
    event.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: true }).then(windowClients => {
        if (windowClients.length > 0) {
          windowClients[0].postMessage({ type: "VALIDATE_RESPONSE", alertId, vote });
        } else {
          // Site closed → fallback to REST API
          fetch("https://campus-emergency-server.onrender.com/api/validate-alert", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer " + localStorage.getItem("token")
            },
            body: JSON.stringify({ alertId, vote })
          });
        }
      })
    );
  }
});
