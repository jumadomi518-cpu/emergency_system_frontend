
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
      localStorage.setItem("data", data.role);
      if (data.role === "user") {
      window.location.replace("./pages/user.html");
      } else {
        window.location.replace("./pages/admin.html");
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


