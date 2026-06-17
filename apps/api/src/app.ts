import path from "node:path";
import fs from "node:fs";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config, projectRoot } from "./config.js";
import { getDb } from "./db/index.js";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import authRouter from "./routes/auth.js";
import clientsRouter from "./routes/clients.js";
import settingsRouter from "./routes/settings.js";
import quotesRouter from "./routes/quotes.js";
import invoicesRouter from "./routes/invoices.js";
import documentsRouter from "./routes/documents.js";
import dashboardRouter from "./routes/dashboard.js";
import profileRouter from "./routes/profile.js";

export function createApp() {
  getDb();
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({ origin: config.webOrigin.split(",").map((value) => value.trim()) }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "gestor-pyme-api" });
  });

  app.use(
    "/api/auth",
    rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 }),
    authRouter,
  );
  app.use("/api", rateLimit({ windowMs: 60 * 1000, limit: 300 }), requireAuth);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/clients", clientsRouter);
  app.use("/api/quotes", quotesRouter);
  app.use("/api/invoices", invoicesRouter);
  app.use("/api/documents", documentsRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/profile", profileRouter);

  const webDist = path.resolve(projectRoot, "apps/web/dist");
  if (config.isProduction && fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get(/^(?!\/api).*/, (_req, res) =>
      res.sendFile(path.join(webDist, "index.html")),
    );
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
