import { config as dotenvConfig } from "dotenv";
import Express from "express";
import { Server as HttpServer } from "http";
import { Socket, Server as SocketServer } from "socket.io";

dotenvConfig();

const app = Express();

const server = new HttpServer(app);

const io = new SocketServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN
      : "http://localhost:8080",
    methods: ["GET", "POST"],
  },
});

console.log(`CORS_ORIGIN: ${process.env.CORS_ORIGIN}`);

io.on("connection", (socket: Socket) => {
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
