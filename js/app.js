function log(msg){
  console.log(msg); // keep browser console logging for later
  const panel = document.getElementById("debugPanel");
  if(!panel) return;
  const time = new Date().toLocaleTimeString();
  panel.innerText += `[${time}] ${typeof msg === "object" ? JSON.stringify(msg) : msg}\n`;
  panel.scrollTop = panel.scrollHeight; // auto-scroll
}


const show = document.querySelector(".show");
const section = document.querySelector("section");
const ma = document.getElementById("map");

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

//  EMERGENCY BUTTON 
function trigger() {
  navigator.geolocation.getCurrentPosition(pos => {
    const latitude = pos.coords.latitude;
    const longitude = pos.coords.longitude;
    const msg = document.getElementById("msg");
    const message = msg.value;
    const type = document.querySelector('input[name="type"]:checked')?.value;
     if (type === undefined) {
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
    type.value = "";
  }, err => log(err), { enableHighAccuracy: true });
  log("Emergency message sent");
}

// LOCATION TRACKING
let watchId = null;
function start() {
  if(watchId) return; // prevent multiple watchers
  watchId = navigator.geolocation.watchPosition(pos => {
    const { latitude, longitude } = pos.coords;
    document.getElementById("statusText").innerText = "ON";

    if(ws && ws.readyState === ws.OPEN){
      ws.send(JSON.stringify({ type: "LOCATION_UPDATE", latitude, longitude }));
    }
  }, err => console.log(err), { enableHighAccuracy: true });
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

// HANDLE WEBSOCKET MESSAGES
async function handleWSMessage(event){
  const msg = JSON.parse(event.data);

  // Crowd Validation
  if (msg.type === "VALIDATE_ALERT") {
    const vote = confirm(msg.message + "\nOK = TRUE, Cancel = FALSE");
    ws.send(JSON.stringify({ type: "VALIDATE_RESPONSE", alertId: msg.alertId, vote }));
 log("validation message received");
 }

  // Emergency Assigned to Responder (LIVE)
  if (msg.type === "EMERGENCY_ASSIGNMENT") {
    const { latitude, longitude, alertId, message, responder } = msg;

    if (emergencyMarker) map.removeLayer(emergencyMarker);
    emergencyMarker = L.marker([latitude, longitude], {
      icon: L.icon({ iconUrl: "emergency.png", iconSize: [32,32] })
    }).addTo(map).bindPopup(message);
    map.setView([latitude, longitude], 15);

    if (responder && responder.id === localStorage.getItem("userId")) {
      trackResponderRoute(responder, [latitude, longitude], alertId);
    }
  log("emergency assighnment");
  }

  // Responder Accepted Alert (victim view)
  if (msg.type === "RESPONDER_ACCEPTED") {
    const { responder, alertId } = msg;
    trackResponder(responder, alertId);
   log("responder acceptes");
  }
}

// TRACK RESPONDER (victim view)
async function trackResponder(responder, alertId) {
  if(!emergencyMarker) return;
  const start = [responder.lat || 0, responder.lng || 0];
  const end = [emergencyMarker.getLatLng().lat, emergencyMarker.getLatLng().lng];

  const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;
  const resp = await fetch(url);
  const data = await resp.json();
  if (!data.routes || data.routes.length === 0) return;

  const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);

  if (responderMarkers[responder.id]) map.removeLayer(responderMarkers[responder.id]);
  responderMarkers[responder.id] = L.marker(coords[0], { icon: L.icon({ iconUrl: "responder.png", iconSize: [32,32] }) }).addTo(map);

  if (routeLines[responder.id]) map.removeLayer(routeLines[responder.id]);
  routeLines[responder.id] = L.polyline(coords, { color: "blue" }).addTo(map);

  let i = 0;
  function animate() {
    if (i >= coords.length) return;
    responderMarkers[responder.id].setLatLng(coords[i]);
    i++;
    requestAnimationFrame(animate);
  }
  animate();
}

// TRACK RESPONDER ROUTE (for responder dashboard)
async function trackResponderRoute(responder, destination, alertId) {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(async pos => {
    const start = [pos.coords.latitude, pos.coords.longitude];
    const end = destination;

    const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (!data.routes || data.routes.length === 0) return;

    const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);

    if (responderMarkers[responder.id]) map.removeLayer(responderMarkers[responder.id]);
    responderMarkers[responder.id] = L.marker(coords[0], { icon: L.icon({ iconUrl: "responder.png", iconSize: [32,32] }) }).addTo(map);

    if (routeLines[responder.id]) map.removeLayer(routeLines[responder.id]);
    routeLines[responder.id] = L.polyline(coords, { color: "blue" }).addTo(map);

    let i = 0;
    function animate() {
      if (i >= coords.length) return;
      responderMarkers[responder.id].setLatLng(coords[i]);
      i++;
      requestAnimationFrame(animate);
    }
    animate();
  }, err => log(err), { enableHighAccuracy: true });
}
