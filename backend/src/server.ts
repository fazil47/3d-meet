import { config as dotenvConfig } from "dotenv";
import Express, { Request, Response, NextFunction } from "express";
import Cors from "cors";
import { Server as HttpServer } from "http";
import { Socket, Server as SocketServer } from "socket.io";
import { connect as MongooseConnect, ObjectId } from "mongoose";
import { sign } from "jsonwebtoken";

import { UserModel as User } from "./models/user.model";
import { RoomModel as Room } from "./models/room.model";

import { authenticateToken } from "./middleware";

dotenvConfig();

const app = Express();
app.use(Express.json());
app.use(Cors());

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
  if (!process.env.ACCESS_TOKEN_SECRET) {
    throw new Error("ACCESS_TOKEN_SECRET is not defined");
  }

  try {
    await User.create({
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
    });

    const accessToken = sign(
      {
        email: req.body.email,
        username: req.body.username,
      },
      process.env.ACCESS_TOKEN_SECRET
    );

    res.json({
      status: "ok",
      user: {
        accessToken: accessToken,
        username: req.body.username,
        email: req.body.email,
      },
    });
  } catch (err) {
    res.json({
      status: "error",
      user: { accessToken: null, username: null, email: null },
    });
  }
});

// Login route
app.post("/login", async (req, res) => {
  if (!process.env.ACCESS_TOKEN_SECRET) {
    throw new Error("ACCESS_TOKEN_SECRET is not defined");
  }

  const user = await User.findOne({
    email: req.body.email,
    password: req.body.password,
  });

  if (user) {
    const accessToken = sign(
      {
        email: user.email,
        username: user.username,
      },
      process.env.ACCESS_TOKEN_SECRET
    );

    res.json({
      status: "ok",
      user: {
        accessToken: accessToken,
        username: user.username,
        email: user.email,
      },
    });
  } else {
    res.json({
      status: "error",
      user: { accessToken: null, name: null, email: null },
    });
  }
});

// Room route
app.post("/room", authenticateToken, async (req, res) => {
  console.log(req.body);

  if (!req.body.room) {
    res.sendStatus(400);
    return;
  }

  const room = await Room.findOne({ id: req.body.room });

  const user = await User.findOne({
    username: req.body.username,
    email: req.body.email,
  });

  if (!user) {
    // Should have been caught by the authentication middleware
    res.sendStatus(500);
    return;
  }

  if (!room) {
    // Room does not exist so create it
    try {
      await Room.create({
        id: req.body.room,
        owner: user._id,
      });
    } catch (err) {
      res.sendStatus(500);
    }
  } else {
    // Room exists so check if the user is the owner
    if (room.owner) {
      if ((room.owner as ObjectId).toString() === user._id.toString()) {
        res.json({ status: "ok", owner: true });
      } else {
        res.json({ status: "ok", owner: false });
      }
    }
  }
});

// WebSocket connection
io.on("connection", (socket: Socket) => {
  socket.on("join-room", async (roomId, username) => {
    // Get number of users in room
    const numClients = io.sockets.adapter.rooms.get(roomId)?.size || 0;

    // If there are no users in the room then check if the user is the owner
    // If new user not owner don't let them join
    if (numClients === 0) {
      // TODO: This is insecure as the user can just change the userId in the request
      const room = await Room.findOne({ id: roomId });
      const user = await User.findOne({ username: username });

      if (room && user) {
        if ((room.owner as ObjectId).toString() !== user._id.toString()) {
          // Emit owner-missing event to the user
          socket.emit("owner-missing");
        }
      }
    }

    console.log(`User ${username} joined room ${roomId}`);
    socket.join(roomId);

    socket.on("user-ready", (userCharacter) => {
      console.log(`User ${username} is ready`);

      socket.broadcast.to(roomId).emit("user-connected", username, userCharacter);
    });

    socket.on("disconnect", () => {
      console.log(`User ${username} left room ${roomId}`);

      socket.broadcast.to(roomId).emit("user-disconnected", username);
    });

    // Broadcast senders position and rotation to all users except the sender
    socket.on("client-update", (position, rotation) => {
      socket.broadcast
        .to(roomId)
        .emit("server-update", username, position, rotation);
    });
  });
});

server.listen(3000);
