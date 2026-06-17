import { Router } from "express";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { HttpError } from "../utils/http.js";

const router = Router();

const clientSchema = z.object({
  type: z.enum(["company", "person"]).default("company"),
  name: z.string().trim().min(1).max(160),
  taxId: z.string().trim().max(40).default(""),
  email: z.string().trim().email().or(z.literal("")).default(""),
  phone: z.string().trim().max(40).default(""),
  address: z.string().trim().max(200).default(""),
  postalCode: z.string().trim().max(20).default(""),
  city: z.string().trim().max(100).default(""),
  country: z.string().trim().max(100).default("España"),
  notes: z.string().trim().max(3000).default(""),
});

const selectClient = `SELECT id, type, name, tax_id AS taxId, email, phone, address,
  postal_code AS postalCode, city, country, notes,
  created_at AS createdAt, updated_at AS updatedAt FROM clients`;

router.get("/", (req, res) => {
  const search = String(req.query.search ?? "").trim();
  const rows = search
    ? getDb()
        .prepare(
          `${selectClient} WHERE name LIKE ? OR tax_id LIKE ? OR email LIKE ? ORDER BY name COLLATE NOCASE`,
        )
        .all(`%${search}%`, `%${search}%`, `%${search}%`)
    : getDb().prepare(`${selectClient} ORDER BY name COLLATE NOCASE`).all();
  res.json(rows);
});

router.get("/:id", (req, res, next) => {
  const client = getDb()
    .prepare(`${selectClient} WHERE id = ?`)
    .get(req.params.id);
  if (!client) return next(new HttpError(404, "Cliente no encontrado"));
  res.json(client);
});

router.post("/", (req, res, next) => {
  try {
    const body = clientSchema.parse(req.body);
    const result = getDb()
      .prepare(
        `INSERT INTO clients
        (type, name, tax_id, email, phone, address, postal_code, city, country, notes)
        VALUES (@type, @name, @taxId, @email, @phone, @address, @postalCode, @city, @country, @notes)`,
      )
      .run(body);
    const client = getDb()
      .prepare(`${selectClient} WHERE id = ?`)
      .get(result.lastInsertRowid);
    res.status(201).json(client);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", (req, res, next) => {
  try {
    const body = clientSchema.parse(req.body);
    const result = getDb()
      .prepare(
        `UPDATE clients SET type=@type, name=@name, tax_id=@taxId,
        email=@email, phone=@phone, address=@address, postal_code=@postalCode,
        city=@city, country=@country, notes=@notes, updated_at=datetime('now')
        WHERE id=@id`,
      )
      .run({ ...body, id: req.params.id });
    if (result.changes === 0) throw new HttpError(404, "Cliente no encontrado");
    res.json(
      getDb().prepare(`${selectClient} WHERE id = ?`).get(req.params.id),
    );
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", (req, res, next) => {
  try {
    const result = getDb()
      .prepare("DELETE FROM clients WHERE id = ?")
      .run(req.params.id);
    if (result.changes === 0) throw new HttpError(404, "Cliente no encontrado");
    res.status(204).send();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("FOREIGN KEY constraint failed")
    ) {
      return next(
        new HttpError(
          409,
          "No se puede eliminar: el cliente tiene presupuestos o facturas asociados",
        ),
      );
    }
    next(error);
  }
});

export default router;
