import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET ?? "development-only-secret-change-me",
  adminUsername: process.env.ADMIN_USERNAME ?? "admin",
  adminPassword: process.env.ADMIN_PASSWORD ?? "cambia-esta-clave",
  databasePath:
    process.env.DATABASE_PATH === ":memory:"
      ? ":memory:"
      : path.resolve(
          projectRoot,
          process.env.DATABASE_PATH ?? "./data/gestor-pyme.db",
        ),
  uploadsPath: path.resolve(
    projectRoot,
    process.env.UPLOADS_PATH ?? "./data/uploads",
  ),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB ?? 10) * 1024 * 1024,
  isProduction: process.env.NODE_ENV === "production",
};
