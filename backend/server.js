const express = require("express");
const app = express();
const server = require("http").Server(app);
const io = require("socket.io")(server);
const { v4: uuidV4 } = require("uuid");

app.get("/", (req, res) => {
  res.render("landing");
});

app.get("/new", (req, res) => {
  res.redirect(`/room/${uuidV4()}`);
});

app.get("/room/:room", (req, res) => {
  res.render("room", { roomId: req.params.room });
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
  });
});

server.listen(3000);
