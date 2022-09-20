import { Room } from "./room";

let roomId: string;
const roomIdDiv = document.getElementById("roomId");

if (roomIdDiv) {
  roomId = roomIdDiv.dataset.roomId
    ? roomIdDiv.dataset.roomId
    : "1234-1234-1234-1234";

  console.log(`Room ID: ${roomId}`);

  new Room(roomId);
}
