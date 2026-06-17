import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import { config } from "../config.js";
import { schemaSql } from "./schema.js";

let database: DatabaseSync | undefined;

export function getDb(): DatabaseSync {
  if (database) return database;

  if (config.databasePath !== ":memory:") {
    fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
  }

  database = new DatabaseSync(config.databasePath);
  database.exec(schemaSql);

  const existingUser = database.prepare("SELECT id FROM users LIMIT 1").get();
  if (!existingUser) {
    const passwordHash = bcrypt.hashSync(config.adminPassword, 12);
    database
      .prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)")
      .run(config.adminUsername, passwordHash);
  }

  return database;
}

export function withTransaction<T>(operation: () => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function closeDb(): void {
  database?.close();
  database = undefined;
}
