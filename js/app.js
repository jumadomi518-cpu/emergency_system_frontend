

navigator.serviceWorker.addEventListener("message", event => {
  const { type, alertId, vote } = event.data;
  if (type === "VALIDATE_RESPONSE") {
    if (ws && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type, alertId, vote }));
      log(`Vote sent from SW: alertId=${alertId}, vote=${vote}`);
    }
  }
});



function log(msg){
  console.log(msg); 
  const panel = document.getElementById("debugPanel");
  if(!panel) return;
  const time = new Date().toLocaleTimeString();
  panel.innerText += `[${time}] ${typeof msg === "object" ? JSON.stringify(msg) : msg}\n`;
  panel.scrollTop = panel.scrollHeight;
}


const show = document.querySelector(".show");
const section = document.querySelector("section");
const ma = document.getElementById("map");
let emergencyMarker;
let responderMarkers = {};
let routeCoordinates = {};       // key alertId, stores full route
let routeRemainingPolyline;
let routeTraveledPolyline;
let mapFollowResponder = true;
const etaDisplay = document.getElementById("etaDisplay"); 





show.onclick = () => {
  section.classList.toggle("scale");
  ma.classList.toggle("expand");
}


// SERVICE WORKER
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js")
    .then(() => log("SW registered"))
    .catch(err => log("SW registration failed:", err));
}

// NOTIFICATION PERMISSION
if ("Notification" in window) {
  Notification.requestPermission().then(permission => console.log("Notification permission:", permission));
}

// CONFIGURABLE BACKEND URL
const WS_URL = "wss://campus-emergency-server.onrender.com";
const REST_URL = "https://campus-emergency-server.onrender.com/api";

// WEBSOCKET WITH RECONNECT
let ws;
function connectWebSocket() {
  ws = new WebSocket(WS_URL);

  ws.addEventListener("open", () => {
    const token = localStorage.getItem("token");
    if(token) ws.send(JSON.stringify({ token }));
    log("WebSocket connected");
  });

  ws.addEventListener("close", () => {
    log("WebSocket disconnected, retrying in 3s...");
    setTimeout(connectWebSocket, 3000); // reconnect loop
  });

  ws.addEventListener("message", handleWSMessage);
}
connectWebSocket();

// MAP SETUP
const map = L.map("map").setView([0,0], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

let emergencyMarker = null;
const responderMarkers = {};
const routeLines = {};
let isAuthenticated = false;

//  EMERGENCY BUTTON 
 function trigger() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    alert("WebSocket not connected yet, try again in a moment.");
    return;
  }

 if (!isAuthenticated) {
    alert("Still authenticating. Please wait.");
    return;
  }



  navigator.geolocation.getCurrentPosition(pos => {
    const latitude = pos.coords.latitude;
    const longitude = pos.coords.longitude;
    log(latitude);
    log(longitude)
    const msg = document.getElementById("msg");
    const message = msg.value;
    const type = document.querySelector('input[name="type"]:checked')?.value;
    if (!type) {
      alert("Select the type of Emergency by checking one of the input above.");
      return;
    }

    ws.send(JSON.stringify({
      type: "EMERGENCY",
      message,
      latitude,
      longitude,
      emergencyType: type
    }));
    alert("Emergency sent!");
    msg.value = "";
  }, err => log(err), { enableHighAccuracy: true });
}

// LOCATION TRACKING

let victimMarker = null;
let watchId = null;
let firstUpdate = true;

function start() {
  if (watchId) return;

  watchId = navigator.geolocation.watchPosition(
    pos => {
      const { latitude, longitude } = pos.coords;
      const newLatLng = [latitude, longitude];

      document.getElementById("statusText").innerText = "ON";
      console.log("Victim coords:", latitude, longitude);

   
      if (!victimMarker) {
        victimMarker = L.marker(newLatLng)
          .addTo(map)
          .bindPopup("Your current location")
          .openPopup();
      } else {
        //Move marker smoothly
        smoothMoveMarker(victimMarker, newLatLng);
      }

      // Focus map on current location only the first time
      if (firstUpdate) {
        map.setView(newLatLng, 15);
        firstUpdate = false;
      }

      // Send location updates to server
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "LOCATION_UPDATE",
          latitude,
          longitude
        }));
      }

    },
    err => {
      console.error("Geolocation error:", err);
      alert("Unable to get location: " + err.message);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 10000
    }
  );
}

function stop() {
if (watchId) navigator.geolocation.clearWatch(watchId);
watchId = null;
document.getElementById("statusText").innerText = "OFF";
}


// PUSH SUBSCRIPTION
async function subscribePush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array("BLWqWGy69vEeRpqjfjM71X3HH9IfF9mDRhaXsqIdysfGLXE0Ur8HjgtyE0VfDK574WK_dbJ7s6uCenB7PmYRbQE")
    });

    await fetch(`${REST_URL}/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: localStorage.getItem("userId"), subscription: sub })
    });

    log("Push subscription sent");
  } catch (err) {
    log("Push subscription failed:", err);
  }
}
subscribePush().catch(console.error);

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function smoothMoveMarker(marker, newLatLng) {
  const currentLatLng = marker.getLatLng();
  const steps = 20; // number of animation steps
  let step = 0;

  const latStep = (newLatLng[0] - currentLatLng.lat) / steps;
  const lngStep = (newLatLng[1] - currentLatLng.lng) / steps;

  function animateStep() {
    if (step >= steps) return;
    marker.setLatLng([
      currentLatLng.lat + latStep * step,
      currentLatLng.lng + lngStep * step
    ]);
    step++;
    requestAnimationFrame(animateStep);
  }

  animateStep();
}

// HANDLE WEBSOCKET MESSAGES
async function handleWSMessage(event){
  const msg = JSON.parse(event.data);
  if (msg.type === "AUTH_SUCCESS") {
    isAuthenticated = true;
    log("Authenticated successfully");
    start();
  }

  // Crowd Validation
  if (msg.type === "VALIDATE_ALERT") {
    const vote = confirm(msg.message + "\nOK = TRUE, Cancel = FALSE");
    ws.send(JSON.stringify({ type: "VALIDATE_RESPONSE", alertId: msg.alertId, vote }));
 log("validation message received");
 }

  // Emergency Assigned to Responder (LIVE)
    if (msg.type === "EMERGENCY_ASSIGNMENT") {
    const { latitude, longitude, alertId, message } = msg;

    if (emergencyMarker) map.removeLayer(emergencyMarker);
    emergencyMarker = L.marker([latitude, longitude], {
      icon: L.icon({ iconUrl: "../assets/emergency.png", iconSize: [32,32] })
    }).addTo(map).bindPopup(message);

    map.setView([latitude, longitude], 15);
  }


  if (msg.type === "SELECTED_ROUTE") {
    const { alertId, coordsFromResponder, distance, duration } = msg;
    if (!coordsFromResponder || coordsFromResponder.length === 0) return;
    // store coordinates for live tracking
    routeCoordinates[alertId] = coordsFromResponder;
    drawFullRoute(alertId);
    etaDisplay.innerText = `Selected Route: ${distance} km - ${duration} min`;
  }


    if (msg.type === "RESPONDER_LOCATION_UPDATE") {
    const responderId = msg.responderId;
    const alertId = msg.alertId;
    const newLatLng = [msg.latitude, msg.longitude];
    // creates or update marker
    if (!responderMarkers[responderId]) {
      responderMarkers[responderId] = L.marker(newLatLng, {
        icon: L.icon({ iconUrl: "responder.png", iconSize: [40,40], className: 'pulsing-responder' })
      }).addTo(map);
    } else {
      smoothMoveMarker(responderMarkers[responderId], newLatLng);
    }

   if (mapFollowResponder) map.panTo(newLatLng, { animate: true });

      if (routeCoordinates[alertId]) {
      updateRouteProgress(alertId, newLatLng);
    }


  // Responder Accepted Alert (victim view)
  if (msg.type === "RESPONDER_ACCEPTED") {
    const { responder, alertId } = msg;
    trackResponder(responder, alertId);
   log("responder accepted");
   log(responder);
   log(alertId);
  }
}



function drawFullRoute(alertId) {
  const coords = routeCoordinates[alertId];
  if (!coords || coords.length === 0) return;

  // remove old polylines
  if (routeRemainingPolyline) map.removeLayer(routeRemainingPolyline);
  if (routeTraveledPolyline) map.removeLayer(routeTraveledPolyline);

  routeRemainingPolyline = L.polyline(coords, { color: "blue", weight: 5, opacity: 0.7 }).addTo(map);
  routeTraveledPolyline = L.polyline([], { color: "green", weight: 5, opacity: 0.7 }).addTo(map);

  map.fitBounds(routeRemainingPolyline.getBounds());
}

// UPDATE ROUTE PROGRESS
function updateRouteProgress(alertId, currentLatLng) {
  const route = routeCoordinates[alertId];
  if (!route) return;

  // find nearest index to current location
  const nearestIdx = route.reduce((closestIdx, point, idx) => {
    const dist = map.distance(point, currentLatLng);
    return dist < map.distance(route[closestIdx], currentLatLng) ? idx : closestIdx;
  }, 0);

  // slice remaining vs traveled
  const remaining = route.slice(nearestIdx);
  const traveled = route.slice(0, nearestIdx + 1);

  if (routeRemainingPolyline) map.removeLayer(routeRemainingPolyline);
  if (routeTraveledPolyline) map.removeLayer(routeTraveledPolyline);

  routeRemainingPolyline = L.polyline(remaining, { color: "blue", weight: 5, opacity: 0.7 }).addTo(map);
  routeTraveledPolyline = L.polyline(traveled, { color: "green", weight: 5, opacity: 0.7 }).addTo(map);

  // ETA & distance
  const distanceLeft = remaining.reduce((sum, point, idx) => {
    if (idx === 0) return 0;
    return sum + map.distance(remaining[idx - 1], point);
  }, 0);

  const averageSpeed = 15;
  const eta = Math.round(distanceLeft / averageSpeed); // seconds
  etaDisplay.innerText = `ETA: ${Math.floor(eta/60)} min ${eta%60} sec, Distance left: ${(distanceLeft/1000).toFixed(2)} km`;

  // arrival alert
  if (distanceLeft < 10) alert("Responder has arrived.");
}

