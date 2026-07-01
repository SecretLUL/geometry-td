import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthenticatedRequest } from "./types";

export const JWT_SECRET = process.env.JWT_SECRET || "super_secret_dev_key_123!";

export function authenticateUser(req: Request, res: Response, next: NextFunction) {
  const isProd = process.env.NODE_ENV === "production";
  const cName = isProd ? "__Host-gtd-session" : "gtd-session";
  const token = req.cookies[cName];

  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; username: string };
    (req as AuthenticatedRequest).user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid session" });
  }
}
