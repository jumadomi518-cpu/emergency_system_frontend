
// DEBUG LOG
function log(msg){
  console.log(msg);
  const panel = document.getElementById("debugPanel");
  if(!panel) return;

  const time = new Date().toLocaleTimeString();
  panel.innerText += `[${time}] ${
    typeof msg === "object" ? JSON.stringify(msg) : msg
  }\n`;
  panel.scrollTop = panel.scrollHeight;
}



// UI TOGGLE
const show = document.querySelector(".show");
const section = document.querySelector("section");
const ma = document.getElementById("map");

let emergencyType = null;

let toggleAccident = true;
let toggleFire = true;
let toggleRobbery = true;

const accident = document.getElementById("accident");
const robbery = document.getElementById("robbery");
const fire = document.getElementById("fire");


accident.onclick = () => {
emergencyType = toggleAccident ? "ACCIDENT" : null;
toggleAccident = !toggleAccident;
accident.classList.toggle("color");
robbery.classList.remove("color");
fire.classList.remove("color");
}

robbery.onclick = () => {
emergencyType = toggleRobbery ? "ROBBERY" : null;
toggleRobbery = !toggleRobbery;
robbery.classList.toggle("color");
accident.classList.remove("color");
fire.classList.remove("color");
}

fire.onclick = () => {
emergencyType = toggleFire ? "FIRE" : null;
toggleFire = !toggleFire;
fire.classList.toggle("color");
robbery.classList.remove("color");
accident.classList.remove("color");
}





show.onclick = () => {
  section.classList.toggle("scale");
  ma.classList.toggle("expand");
};



// GLOBAL STATE 
let ws;
let isAuthenticated = false;

let emergencyMarker = null;
let victimMarker = null;

let responderMarkers = {};                 // responderId -> marker
let routeCoordinates = {};                 // alertId -> full route array
let routeRemainingPolyline = {};           // alertId -> polyline
let routeTraveledPolyline = {};            // alertId -> polyline
let arrivalTriggered = {};                 // alertId -> boolean

let watchId = null;
let firstUpdate = true;
let mapFollowResponder = true;

const etaDisplay = document.getElementById("etaDisplay");



// MAP SETUP
const map = L.map("map").setView([0,0], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);


// NOTIFICATION PERMISSION
if ("Notification" in window) {
  Notification.requestPermission()
    .then(permission => log("Notification permission: " + permission));
}


// WEBSOCKET
const WS_URL = "wss://campus-emergency-server.onrender.com";
const REST_URL = "https://campus-emergency-server.onrender.com/api";

function connectWebSocket(){
  ws = new WebSocket(WS_URL);

  ws.addEventListener("open", () => {
    log("WebSocket connected");
    const token = localStorage.getItem("token");
    if(token){
      ws.send(JSON.stringify({ token }));
    }
  });

  ws.addEventListener("close", () => {
    log("WebSocket disconnected. Reconnecting in 3s...");
    setTimeout(connectWebSocket, 3000);
  });

  ws.addEventListener("message", handleWSMessage);
}

connectWebSocket();


// EMERGENCY TRIGGER
function trigger(){

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    alert("Establishing connection please wait...");
    return;
  }

  if (!isAuthenticated) {
    alert("Still authenticating.");
    return;
  }

  navigator.geolocation.getCurrentPosition(pos => {

    const { latitude, longitude } = pos.coords;
    const message = document.getElementById("msg").value;
    

    if (!emergencyType) {
      alert("Select emergency type.");
      return;
    }
console.log(emergencyType);
    ws.send(JSON.stringify({
      type: "EMERGENCY",
      message,
      latitude,
      longitude,
      emergencyType
    }));

    alert("Emergency sent!");
    document.getElementById("msg").value = "";

  }, err => alert(err.message), { enableHighAccuracy: true });
}

// LOCATION TRACKING
function start(){
  if (watchId) return;

  watchId = navigator.geolocation.watchPosition(
    pos => {

      const { latitude, longitude } = pos.coords;
      const newLatLng = [latitude, longitude];

      document.getElementById("statusText").innerText = "ON";

      if (!victimMarker) {
        victimMarker = L.marker(newLatLng)
          .addTo(map)
          .bindPopup("Your current location")
          .openPopup();
      } else {
        smoothMoveMarker(victimMarker, newLatLng);
      }

      if (firstUpdate) {
        map.setView(newLatLng, 15);
        firstUpdate = false;
      }

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "LOCATION_UPDATE",
          latitude,
          longitude
        }));
      }

    },
    err => alert("Location error: " + err.message),
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
  );
}

function stop(){
  if (watchId) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  document.getElementById("statusText").innerText = "OFF";
}

// WEBSOCKET HANDLER
async function handleWSMessage(event){

  const msg = JSON.parse(event.data);

  if (msg.type === "AUTH_SUCCESS") {
    isAuthenticated = true;
    log("Authenticated");
    start();
  }

  if (msg.type === "VALIDATE_ALERT") {
    const vote = confirm(msg.message + "\nOK = TRUE, Cancel = FALSE");
    log("validate alert received");
    ws.send(JSON.stringify({
      type: "VALIDATE_RESPONSE",
      alertId: msg.alertId,
      vote
    }));
  }

  if (msg.type === "EMERGENCY_ASSIGNMENT") {
    const { latitude, longitude, message } = msg;

    if (emergencyMarker) map.removeLayer(emergencyMarker);

    emergencyMarker = L.marker([latitude, longitude], {
      icon: L.icon({
        iconUrl: "../assets/emergency.png",
        iconSize: [32,32]
      })
    }).addTo(map).bindPopup(message);

    map.setView([latitude, longitude], 15);
  }

  if (msg.type === "SELECTED_ROUTE") {

   log("SELECTED ROUTE RECEIVED TO THE CREATOR");
    const { alertId, coordsFromResponder, distance, duration } = msg;
    log(msg);
    if (!coordsFromResponder?.length) return;

    routeCoordinates[alertId] = coordsFromResponder;
    arrivalTriggered[alertId] = false;

    drawFullRoute(alertId);

    etaDisplay.innerText =
      `Selected Route: ${distance} km - ${duration} min`;
  }

  if (msg.type === "RESPONDER_LOCATION_UPDATE") {
     log("NEW LOCATION RECEIVED");
    const { responderId, alertId, latitude, longitude } = msg;
    const newLatLng = [latitude, longitude];

    if (!responderMarkers[responderId]) {
      responderMarkers[responderId] = L.marker(newLatLng, {
        icon: L.icon({
          iconUrl: "../assets/emergency.png",
          iconSize: [32,32]
        })
      }).addTo(map);
    } else {
      smoothMoveMarker(responderMarkers[responderId], newLatLng);
    }

    if (mapFollowResponder)
      map.panTo(newLatLng, { animate: true });

    if (routeCoordinates[alertId])
      updateRouteProgress(alertId, newLatLng);
  }
}

// ROUTE DRAWING
function drawFullRoute(alertId){

  const coords = routeCoordinates[alertId];
  if (!coords) return;

  if (routeRemainingPolyline[alertId])
    map.removeLayer(routeRemainingPolyline[alertId]);

  if (routeTraveledPolyline[alertId])
    map.removeLayer(routeTraveledPolyline[alertId]);

  routeRemainingPolyline[alertId] =
    L.polyline(coords, { color:"blue", weight:5 }).addTo(map);

  routeTraveledPolyline[alertId] =
    L.polyline([], { color:"green", weight:5 }).addTo(map);

  map.fitBounds(routeRemainingPolyline[alertId].getBounds());
}

// ROUTE PROGRESS
function updateRouteProgress(alertId, currentLatLng){

  const route = routeCoordinates[alertId];
  if (!route) return;

  const nearestIdx = route.reduce((closestIdx, point, idx) => {
    const dist = map.distance(point, currentLatLng);
    return dist < map.distance(route[closestIdx], currentLatLng)
      ? idx
      : closestIdx;
  }, 0);

  const remaining = route.slice(nearestIdx);
  const traveled = route.slice(0, nearestIdx + 1);

  if (routeRemainingPolyline[alertId])
    map.removeLayer(routeRemainingPolyline[alertId]);

  if (routeTraveledPolyline[alertId])
    map.removeLayer(routeTraveledPolyline[alertId]);

  routeRemainingPolyline[alertId] =
    L.polyline(remaining, { color:"blue", weight:5 }).addTo(map);

  routeTraveledPolyline[alertId] =
    L.polyline(traveled, { color:"green", weight:5 }).addTo(map);

  const distanceLeft = remaining.reduce((sum, point, idx) => {
    if (idx === 0) return 0;
    return sum + map.distance(remaining[idx - 1], point);
  }, 0);

  // ETA CALCULATION
  const avgSpeedKmh = 40;
  const speedMps = (avgSpeedKmh * 1000) / 3600;
  const etaSeconds = Math.round(distanceLeft / speedMps);

  etaDisplay.innerText =
    `ETA: ${Math.floor(etaSeconds/60)} min ${etaSeconds%60} sec
     | Distance left: ${(distanceLeft/1000).toFixed(2)} km`;

  if (distanceLeft < 10 && !arrivalTriggered[alertId]) {
    arrivalTriggered[alertId] = true;
    alert("Responder has arrived.");
  }
}


// SMOOTH MARKER
function smoothMoveMarker(marker, newLatLng){
  const current = marker.getLatLng();
  const steps = 20;
  let step = 0;

  const latStep = (newLatLng[0] - current.lat) / steps;
  const lngStep = (newLatLng[1] - current.lng) / steps;

  function animate(){
    if (step >= steps) return;

    marker.setLatLng([
      current.lat + latStep * step,
      current.lng + lngStep * step
    ]);

    step++;
    requestAnimationFrame(animate);
  }

  animate();
}
