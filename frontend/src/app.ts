import { Room } from "./room";

document.addEventListener("DOMContentLoaded", () => {
  const { registerForm, loginForm, joiningForm } = findForms();

  if (!joiningForm || !loginForm || !registerForm) {
    console.log("Error: Could not find forms");
    return;
  }

  const userDetails = getUserDetails();

  if (userDetails) {
    setRoomJoinScreen(userDetails.email);

    registerForm.style.display = "none";
    loginForm.style.display = "none";
    joiningForm.style.display = "grid";
  } else {
    registerForm.style.display = "none";
    loginForm.style.display = "grid";
    joiningForm.style.display = "none";
  }

  registerForm.addEventListener("submit", registerFormSubmitHandler);
  loginForm.addEventListener("submit", loginFormSubmitHandler);
  joiningForm.addEventListener("submit", joiningFormSubmitHandler);

  const loginLink = document.getElementById("login-link");
  const registerLink = document.getElementById("register-link");

  if (!loginLink || !registerLink) {
    console.log("Error: Could not find links");
    return;
  }

  loginLink.addEventListener("click", () => {
    registerForm.style.display = "none";
    joiningForm.style.display = "none";
    loginForm.style.display = "grid";
  });
  registerLink.addEventListener("click", () => {
    loginForm.style.display = "none";
    joiningForm.style.display = "none";
    registerForm.style.display = "grid";
  });
});

function getUserDetails() {
  const accessToken = localStorage.getItem("accessToken");
  const username = localStorage.getItem("username");
  const email = localStorage.getItem("email");

  if (!accessToken || !username || !email) {
    return null;
  }

  return {
    accessToken,
    username,
    email,
  };
}

function findForms(): {
  registerForm: HTMLElement | null;
  loginForm: HTMLElement | null;
  joiningForm: HTMLElement | null;
} {
  const registerForm = document.getElementById("register-form");
  const loginForm = document.getElementById("login-form");
  const joiningForm = document.getElementById("joining-form");

  return {
    registerForm: registerForm,
    loginForm: loginForm,
    joiningForm: joiningForm,
  };
}

function setRoomJoinScreen(email: string) {
  const userEmailDisplay = document.getElementById("user-email-display");
  const userLogoutButton = document.getElementById("user-logout-button");

  if (!userEmailDisplay || !userLogoutButton) {
    console.log("Error: Could not find user display elements");
    return;
  }

  userEmailDisplay.innerText = `Logged in as ${email} - `;
  userLogoutButton.addEventListener("click", logout);
}

function login(accessToken: string, username: string, email: string) {
  const { registerForm, loginForm, joiningForm } = findForms();

  if (!joiningForm || !loginForm || !registerForm) {
    console.log("Error: Could not find forms");
    return;
  }

  registerForm.style.display = "none";
  loginForm.style.display = "none";
  joiningForm.style.display = "grid";

  localStorage.setItem("accessToken", accessToken);
  localStorage.setItem("username", username);
  localStorage.setItem("email", email);

  setRoomJoinScreen(email);
}

function logout() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("username");
  localStorage.removeItem("email");

  const { registerForm, loginForm, joiningForm } = findForms();

  if (!joiningForm || !loginForm || !registerForm) {
    console.log("Error: Could not find forms");
    return;
  }

  registerForm.style.display = "none";
  loginForm.style.display = "grid";
  joiningForm.style.display = "none";
}

async function registerFormSubmitHandler(event: SubmitEvent) {
  event.preventDefault();

  const formData = new FormData(event.target as HTMLFormElement);
  const username = formData.get("username") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (username.length === 0 || email.length === 0 || password.length === 0) {
    console.error("Register form data not complete.");
    return;
  }

  const response = await fetch(process.env.SERVER_URL + "/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username: username,
      email: email,
      password: password,
    }),
  });

  const data = await response.json();

  if (data.status === "ok") {
    login(data.user.accessToken, data.user.username, data.user.email);
    alert("Logged in!");
    (event.target as HTMLFormElement).style.display = "none";
  } else {
    alert("Please check your email and password.");
  }
}

async function loginFormSubmitHandler(event: SubmitEvent) {
  event.preventDefault();

  const formData = new FormData(event.target as HTMLFormElement);
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (email.length === 0 || password.length === 0) {
    console.error("Login form data not complete.");
    return;
  }

  const response = await fetch(process.env.SERVER_URL + "/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: email,
      password: password,
    }),
  });

  const data = await response.json();

  if (data.status === "ok") {
    login(data.user.accessToken, data.user.username, data.user.email);
    alert("Logged in!");
    (event.target as HTMLFormElement).style.display = "none";
  } else {
    alert("Please check your email and password.");
  }
}

async function joiningFormSubmitHandler(event: SubmitEvent) {
  event.preventDefault();

  const prescreenDiv = document.getElementById("prescreen");

  if (!prescreenDiv) {
    console.log("No content div found");
    return;
  }

  const formData = new FormData(event.target as HTMLFormElement);
  const room = formData.get("room") as string;

  if (room.length === 0) {
    console.error("Joining form data not complete.");
    return;
  }

  if (
    localStorage.getItem("username") === null ||
    localStorage.getItem("accessToken") === null
  ) {
    logout();
    alert("Please log in first.");
    return;
  }

  const response = await fetch(process.env.SERVER_URL + "/authorize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + localStorage.getItem("accessToken"),
    },
  });

  if (response && response.ok) {
    new Room(localStorage.getItem("username") || "ErrorUser", room);
    (event.target as HTMLFormElement).style.display = "none";
    prescreenDiv.style.display = "none";
  } else {
    prescreenDiv.style.display = "flex";
  }
}
