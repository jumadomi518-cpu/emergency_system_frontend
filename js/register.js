
const form = document.querySelector("form");
    const name = document.querySelector("#name");
    const phone = document.querySelector("#phone");
    const password = document.querySelector("#password");
    const confirm = document.querySelector("#confirm");
    const email = document.querySelector("#email");
    const showPass = document.querySelector(".showPass");
    const showConfir = document.querySelector(".showConfir");

    const inputs = [name, phone, password, confirm, email];
    const submitBtn = document.querySelector("button[type='submit']");

    let togglePass = true;
    let toggleConfir = true;

    showPass.onclick = () => {
      showPass.classList.toggle("togglePassword");
      password.type = togglePass ? "text" : "password";
      togglePass = !togglePass;
    }

    showConfir.onclick = () => {
      showConfir.classList.toggle("togglePassword");
    confirm.type = toggleConfir ? "text" : "password";
      toggleConfir = !toggleConfir;
    }

    const errorMsg = document.querySelector(".errorMsg");


    inputs.forEach((input) => {
      input.oninput = () => {
        errorMsg.classList.remove("showError");
      }
    })


  const regex = /^(07|01)\d{8}$/;
  const regex2 = /[a-zA-Z]+ [a-zA-Z]+/;

    form.onsubmit = async (e) => {
      e.preventDefault();
      if  (!regex.test(phone.value)) {
        errorMsg.innerText = "Your phone number should start with 07/01 and strictly equal to 10 digits.";
        errorMsg.classList.add("showError")
      } else if (password.value.length < 8) {
        errorMsg.innerText = "Please choose a strong password with atleast 8 characters";
        errorMsg.classList.add("showError")
      } else if (password.value !== confirm.value) {
        errorMsg.innerText = "Your passwords don't match"
        errorMsg.classList.add("showError")
      } else {
        submitBtn.innerHTML = "";
        const spin = document.createElement("span");
        spin.setAttribute("class", "spin");
        submitBtn.appendChild(spin);



       const res = await fetch("https://campus-emergency-server.onrender.com/api/register", {
    method: "POST",
    headers: {
      'Content-Type': "application/json"
    },
    body: JSON.stringify({
      name: name.value,
      phone: phone.value,
      email: email.value,
      password: password.value
    })
  });

  localStorage.setItem('email', email.value);
  const feedback = await res.json();
  console.log(feedback);
  if ( feedback.status === "success" ) {
  inputs.forEach((input) => {
    input.value = "";

  });

    submitBtn.innerHTML = "";
    submitBtn.innerText = "submit";

  window.location.href = "../forms/otp.html";
  } else if (feedback.status === "user exists") {
    submitBtn.innerHTML = "";
    submitBtn.innerText = "submit";
    errorMsg.innerText = "The user with email already exists";
    errorMsg.classList.add("showError");
  } else {
    errorMsg.innerText = "There was a problem creating an account";
  }

      }



    }










