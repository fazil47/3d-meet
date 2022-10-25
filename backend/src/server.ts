import { config as dotenvConfig } from "dotenv";
import Express, { Request, Response, NextFunction } from "express";
import Cors from "cors";
import { Server as HttpServer } from "http";
import { Socket, Server as SocketServer } from "socket.io";
import { connect as MongooseConnect } from "mongoose";
import { UserModel as User } from "./models/user.model";
import { sign, verify } from "jsonwebtoken";

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
        name: user.username,
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

// Authentication middleware
function authenticateToken(req: Request, res: Response, nex: NextFunction) {
  if (!process.env.ACCESS_TOKEN_SECRET) {
    console.error("ACCESS_TOKEN_SECRET is not defined");
    return res.sendStatus(500);
  }

  if (!req.headers.authorization) {
    return res.sendStatus(401);
  }

  // Token is in the format "Bearer <token>"
  const authHeader = req.headers.authorization;

  if (!authHeader || authHeader.split(" ")[0] != "Bearer") {
    return res.sendStatus(401);
  }

  const token = authHeader.split(" ")[1];

  if (token === null) {
    return res.sendStatus(401);
  }

  verify(
    token,
    process.env.ACCESS_TOKEN_SECRET || "",
    (err: any, userData: any) => {
      if (
        err ||
        !userData ||
        Object.keys(userData).indexOf("email") === -1 ||
        Object.keys(userData).indexOf("username") === -1
      ) {
        return res.sendStatus(403);
      }

      req.body.username = userData.username;
      req.body.email = userData.email;

      console.log("UserData", userData);
      nex();
    }
  );
}

// Room route
app.post("/authorize", authenticateToken, async (req, res) => {
  res.json({ status: "ok" });
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
