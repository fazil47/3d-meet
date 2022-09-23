const express = require("express");
const app = express();

const server = require("http").Server(app);

const io = require("socket.io")(server, {
  cors: { origin: "http://localhost:8080", methods: ["GET", "POST"] },
});

io.on("connection", (socket) => {
  socket.on("join-room", (roomId, userId) => {
    socket.join(roomId);

    socket.on("user-ready", () => {
      socket.broadcast.to(roomId).emit("user-connected", userId);
    });

    socket.on("disconnect", () => {
      socket.broadcast.to(roomId).emit("user-disconnected", userId);
    });

    socket.on("client-update", (position, rotation) => {
      socket.broadcast
        .to(roomId)
        .emit("server-update", userId, position, rotation);
      console.log(`client update from user ${userId}: `, position, rotation);
    });
  });
});

server.listen(3000);
