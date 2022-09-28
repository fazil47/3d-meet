require("dotenv").config();

const express = require("express");
const app = express();

const server = require("http").Server(app);
const io = require("socket.io")(server, {
  cors: { origin: process.env.CORS_ORIGIN, methods: ["GET", "POST"] },
});

io.on("connection", (socket) => {
  socket.on("join-room", (roomId, userId) => {
    console.log(`User ${userId} joined room ${roomId}`);

    socket.join(roomId);

    socket.on("user-ready", (userCharacter) => {
      console.log(`User ${userId} is ready`);

      socket.broadcast.to(roomId).emit("user-connected", userId, userCharacter);
    });

    socket.on("disconnect", () => {
      console.log(`User ${userId} left room ${roomId}`);

      socket.broadcast.to(roomId).emit("user-disconnected", userId);
    });

    // Broadcast senders position and rotation to all users except the sender
    socket.on("client-update", (position, rotation) => {
      socket.broadcast
        .to(roomId)
        .emit("server-update", userId, position, rotation);
    });
  });
});

server.listen(3000);
