
// SERVICE WORKER
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js")
    .then(() => console.log("SW registered"))
    .catch(err => console.log("SW registration failed: " + err));
}

function saveTokenForSW(token) {
  const request = indexedDB.open("emergencyDB", 1);

  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains("tokens")) {
      db.createObjectStore("tokens");
    }
  };


const REST_URL = "https://campus-emergency-server.onrender.com/api";

async function subscribePush() {
  try {
    const reg = await navigator.serviceWorker.ready;

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        "BLWqWGy69vEeRpqjfjM71X3HH9IfF9mDRhaXsqIdysfGLXE0Ur8HjgtyE0VfDK574WK_dbJ7s6uCenB7PmYRbQE"
      )
    });

    await fetch(`${REST_URL}/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: localStorage.getItem("userId"),
        subscription: sub
      })
    });

    alert("Push subscription sent to server");

  } catch (err) {
    alert("Push subscription failed: " + err.message);
  }
}



function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i)
    outputArray[i] = rawData.charCodeAt(i);

  return outputArray;
}








  request.onsuccess = () => {
    const db = request.result;
    const tx = db.transaction("tokens", "readwrite");
    tx.objectStore("tokens").put(token, "authToken");
    tx.oncomplete = () => console.log("Token saved for SW fallback");
  };

  request.onerror = (err) => console.error("IndexedDB error saving token", err);
}



const error = document.querySelector(".errorMsg");
const btn = document.querySelector("button");
    const form = document.querySelector("form");
    const email = document.querySelector("#email");
    const password = document.querySelector("#password");

    const inputs = [ email, password ];
    inputs.forEach((input) => {
      input.oninput = () => {
        error.classList.remove("showError");
      }
    });


    form.onsubmit = async (e) => {
  e.preventDefault();
  btn.innerText = "Processing...";

  try {
    const res = await fetch("https://campus-emergency-server.onrender.com/api/login", {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.value,
        password: password.value
      })
    });

    const data = await res.json();

    if (data.success) {
      localStorage.setItem("token", data.token);
      saveTokenForSW(data.token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("userId", data.userId);
      subscribePush();
      if (data.role === "user") {
      window.location.replace("./pages/user.html");
        } else if (data.role === "traffic") {
         window.location.replace("./pages/traffic.html");
         } else {
        window.location.replace("./pages/responder.html");
      }

    } else {                                 error.innerText = data.message;
      error.classList.add("showError");
    }

  } catch (err) {
    console.error("Fetch failed:", err);
    error.innerText = "Network error. Try again.";
    error.classList.add("showError");
  } finally {
    btn.innerText = "Log in";
  }
};


