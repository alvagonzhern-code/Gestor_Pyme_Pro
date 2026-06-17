import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { config } from "../config.js";
import { getDb } from "../db/index.js";
import { HttpError } from "../utils/http.js";

const router = Router();

fs.mkdirSync(config.uploadsPath, { recursive: true });

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const storage = multer.diskStorage({
  destination: config.uploadsPath,
  filename: (_req, file, callback) => {
    const extension = path
      .extname(file.originalname)
      .toLowerCase()
      .slice(0, 10);
    callback(null, `${crypto.randomUUID()}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadBytes, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(new HttpError(400, "Tipo de archivo no permitido"));
    }
    callback(null, true);
  },
});

const documentListSql = `SELECT d.id, d.client_id AS clientId, c.name AS clientName,
  d.filename, d.mime_type AS mimeType, d.size_bytes AS sizeBytes,
  d.category, d.notes, d.uploaded_at AS uploadedAt
  FROM documents d LEFT JOIN clients c ON c.id=d.client_id`;

router.get("/", (req, res) => {
  const clientId = String(req.query.clientId ?? "").trim();
  const rows = clientId
    ? getDb()
        .prepare(
          `${documentListSql} WHERE d.client_id=? ORDER BY d.uploaded_at DESC`,
        )
        .all(clientId)
    : getDb().prepare(`${documentListSql} ORDER BY d.uploaded_at DESC`).all();
  res.json(rows);
});

router.post("/", upload.single("file"), (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, "Debe seleccionar un archivo");
    const fields = z
      .object({
        clientId: z.coerce
          .number()
          .int()
          .positive()
          .optional()
          .or(z.literal("").transform(() => undefined)),
        category: z.string().trim().min(1).max(60).default("general"),
        notes: z.string().trim().max(1000).default(""),
      })
      .parse(req.body);

    const result = getDb()
      .prepare(
        `INSERT INTO documents
      (client_id, filename, stored_name, mime_type, size_bytes, category, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        fields.clientId ?? null,
        req.file.originalname,
        req.file.filename,
        req.file.mimetype,
        req.file.size,
        fields.category,
        fields.notes,
      );

    const document = getDb()
      .prepare(`${documentListSql} WHERE d.id=?`)
      .get(result.lastInsertRowid);
    res.status(201).json(document);
  } catch (error) {
    if (req.file) fs.rmSync(req.file.path, { force: true });
    next(error);
  }
});

router.get("/:id/download", (req, res, next) => {
  const document = getDb()
    .prepare(
      `SELECT filename, stored_name AS storedName,
    mime_type AS mimeType FROM documents WHERE id=?`,
    )
    .get(req.params.id) as
    | { filename: string; storedName: string; mimeType: string }
    | undefined;
  if (!document) return next(new HttpError(404, "Documento no encontrado"));
  const filePath = path.join(config.uploadsPath, document.storedName);
  if (!fs.existsSync(filePath))
    return next(new HttpError(410, "El archivo físico ya no está disponible"));
  res.type(document.mimeType);
  res.download(filePath, document.filename);
});

router.delete("/:id", (req, res, next) => {
  const document = getDb()
    .prepare("SELECT stored_name AS storedName FROM documents WHERE id=?")
    .get(req.params.id) as { storedName: string } | undefined;
  if (!document) return next(new HttpError(404, "Documento no encontrado"));
  getDb().prepare("DELETE FROM documents WHERE id=?").run(req.params.id);
  fs.rmSync(path.join(config.uploadsPath, document.storedName), {
    force: true,
  });
  res.status(204).send();
});

export default router;
