

// Listen for push notifications
self.addEventListener("push", event => {
  const data = event.data ? event.data.json() : {};

  const options = {
    body: "An emergency has been triggered near you. Please confirm.",
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
    self.registration.showNotification("Mbiu Emergency Alert", options)
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
      clients.matchAll({ type: "window", includeUncontrolled: true }).then(async windowClients => {
        if (windowClients.length > 0) {
          // Send vote to all open tabs
          windowClients.forEach(client => {
            client.postMessage({ type: "VALIDATE_RESPONSE", alertId, vote });
          });
        } else {
          // Fallback: send vote via REST API
          // Read token from IndexedDB
          const dbRequest = indexedDB.open("emergencyDB", 1);
          
          dbRequest.onupgradeneeded = () => {
            const db = dbRequest.result;
            if (!db.objectStoreNames.contains("tokens")) {
              db.createObjectStore("tokens");
            }
          };

          dbRequest.onsuccess = () => {
            const db = dbRequest.result;
            const tx = db.transaction("tokens", "readonly");
            const store = tx.objectStore("tokens");
            const getRequest = store.get("authToken");

            getRequest.onsuccess = async () => {
              const token = getRequest.result;
              if (!token) return;

              try {
                await fetch("https://campus-emergency-server.onrender.com/api/validate-alert", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + token
                  },
                  body: JSON.stringify({ alertId, vote })
                });
              } catch (err) {
                console.error("Fallback REST call failed:", err);
              }
            };

            getRequest.onerror = err => {
              console.error("Failed to read token from IndexedDB", err);
            };
          };

          dbRequest.onerror = err => {
            console.error("IndexedDB open error", err);
          };
        }
      })
    );
  }
});
