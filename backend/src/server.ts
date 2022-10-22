import { config as dotenvConfig } from "dotenv";
import Express from "express";
import { Server as HttpServer } from "http";
import { Socket, Server as SocketServer } from "socket.io";
import { connect as MongooseConnect } from "mongoose";
import { UserModel as User } from "./models/user.model";

dotenvConfig();

const app = Express();

MongooseConnect(process.env.MONGODB_URI || "", {});

const server = new HttpServer(app);

const io = new SocketServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "",
    methods: ["GET", "POST"],
  },
});

console.log(`CORS_ORIGIN: ${process.env.CORS_ORIGIN}`);

// Register route
app.post("/register", async (req, res) => {
  console.log(req.body);

  try {
    await User.create({
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
    });

    res.json({ status: "ok" });
  } catch (err) {
    res.json({ status: "error", error: err });
  }
});

// Login route
app.post("/login", async (req, res) => {
  const user = await User.findOne({
    email: req.body.email,
    password: req.body.password,
  });

  if (user) {
    res.json({ status: "ok", user: true });
  } else {
    res.json({ status: "error", user: false });
  }
});

// WebSocket connection
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
