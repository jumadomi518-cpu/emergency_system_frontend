
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


