import { NextFunction, Request, Response } from "express";
import { verify } from "jsonwebtoken";

// Authentication middleware
export function authenticateToken(
  req: Request,
  res: Response,
  nex: NextFunction
) {
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

      nex();
    }
  );
}
