import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { HttpError } from "../utils/http.js";
import { config } from "../config.js";

export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(new HttpError(404, `Ruta no encontrada: ${req.method} ${req.path}`));
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: "Datos no válidos",
      details: error.flatten(),
    });
  }

  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: error.message });
  }

  if (error instanceof HttpError) {
    return res
      .status(error.status)
      .json({ error: error.message, details: error.details });
  }

  const message =
    error instanceof Error ? error.message : "Error interno del servidor";
  console.error(error);
  return res
    .status(500)
    .json({
      error: config.isProduction ? "Error interno del servidor" : message,
    });
}
