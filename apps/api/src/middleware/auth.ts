import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { HttpError } from "../utils/http.js";

export type AuthenticatedRequest = Request & {
  user?: { id: number; username: string };
};

export function requireAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
) {
  const authorization = req.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return next(new HttpError(401, "Autenticación requerida"));
  }

  try {
    const payload = jwt.verify(authorization.slice(7), config.jwtSecret) as {
      sub: string;
      username: string;
    };
    req.user = { id: Number(payload.sub), username: payload.username };
    next();
  } catch {
    next(new HttpError(401, "Sesión no válida o caducada"));
  }
}
