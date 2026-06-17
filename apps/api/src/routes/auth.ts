import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { config } from "../config.js";
import { HttpError } from "../utils/http.js";

const router = Router();
const loginSchema = z.object({
  username: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(200),
});

router.post("/login", (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = getDb()
      .prepare(
        "SELECT id, username, password_hash FROM users WHERE username = ?",
      )
      .get(body.username) as
      | { id: number; username: string; password_hash: string }
      | undefined;

    if (!user || !bcrypt.compareSync(body.password, user.password_hash)) {
      throw new HttpError(401, "Usuario o contraseña incorrectos");
    }

    const token = jwt.sign(
      { sub: String(user.id), username: user.username },
      config.jwtSecret,
      { expiresIn: "12h" },
    );

    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (error) {
    next(error);
  }
});

export default router;
