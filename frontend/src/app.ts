import { Room } from "./room";

document.addEventListener("DOMContentLoaded", () => {
  const joiningScreen = document.getElementById("joining-screen");

  const form = document.getElementById("joining-form");
  if (!form || !joiningScreen) {
    return;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const nameInput = document.getElementById("name") as HTMLInputElement;
    const roomInput = document.getElementById("room") as HTMLInputElement;

    if (!nameInput || !roomInput) {
      return;
    }

    new Room(nameInput.value, roomInput.value);

    joiningScreen.style.display = "none";
  });
});
