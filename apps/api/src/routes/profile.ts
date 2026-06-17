import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getDb } from "../db/index.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { HttpError } from "../utils/http.js";

const router = Router();

router.put("/password", (req: AuthenticatedRequest, res, next) => {
  try {
    const body = z
      .object({
        currentPassword: z.string().min(1).max(200),
        newPassword: z
          .string()
          .min(10, "La nueva contraseña debe tener al menos 10 caracteres")
          .max(200),
      })
      .parse(req.body);
    if (!req.user) throw new HttpError(401, "Autenticación requerida");
    const user = getDb()
      .prepare("SELECT id, password_hash AS passwordHash FROM users WHERE id=?")
      .get(req.user.id) as { id: number; passwordHash: string } | undefined;
    if (!user || !bcrypt.compareSync(body.currentPassword, user.passwordHash)) {
      throw new HttpError(400, "La contraseña actual no es correcta");
    }
    getDb()
      .prepare("UPDATE users SET password_hash=? WHERE id=?")
      .run(bcrypt.hashSync(body.newPassword, 12), user.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
