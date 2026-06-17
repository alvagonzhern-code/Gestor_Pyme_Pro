import { Router } from "express";
import { z } from "zod";
import { getDb, withTransaction } from "../db/index.js";
import { calculateTotals } from "../utils/money.js";
import { nextDocumentNumber } from "../utils/numbering.js";
import { HttpError } from "../utils/http.js";
import { addDaysIso } from "../utils/dates.js";
import { streamBusinessDocumentPdf } from "../services/pdf.js";

const router = Router();

const itemSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: z.number().positive().max(1_000_000),
  unitPrice: z.number().min(0).max(1_000_000_000),
  taxRate: z.number().min(0).max(100),
});

const quoteSchema = z.object({
  clientId: z.number().int().positive(),
  issueDate: z.string().date(),
  expiryDate: z.string().date(),
  status: z
    .enum(["draft", "sent", "accepted", "rejected", "expired"])
    .default("draft"),
  notes: z.string().trim().max(5000).default(""),
  items: z.array(itemSchema).min(1).max(100),
});

const quoteListSql = `SELECT q.id, q.number, q.client_id AS clientId, c.name AS clientName,
  q.issue_date AS issueDate, q.expiry_date AS expiryDate, q.status, q.notes,
  q.subtotal, q.tax_total AS taxTotal, q.total,
  q.created_at AS createdAt, q.updated_at AS updatedAt
  FROM quotes q JOIN clients c ON c.id = q.client_id`;

function getQuote(id: number | string) {
  const db = getDb();
  const quote = db.prepare(`${quoteListSql} WHERE q.id = ?`).get(id) as
    | Record<string, unknown>
    | undefined;
  if (!quote) return undefined;
  const items = db
    .prepare(
      `SELECT id, description, quantity, unit_price AS unitPrice,
    tax_rate AS taxRate, sort_order AS sortOrder FROM quote_items
    WHERE quote_id = ? ORDER BY sort_order, id`,
    )
    .all(id);
  return { ...quote, items };
}

router.get("/", (req, res) => {
  const status = String(req.query.status ?? "").trim();
  const search = String(req.query.search ?? "").trim();
  const clauses: string[] = [];
  const params: string[] = [];
  if (status) {
    clauses.push("q.status = ?");
    params.push(status);
  }
  if (search) {
    clauses.push("(q.number LIKE ? OR c.name LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
  const rows = getDb()
    .prepare(`${quoteListSql}${where} ORDER BY q.issue_date DESC, q.id DESC`)
    .all(...params);
  res.json(rows);
});

router.get("/:id/pdf", (req, res, next) => {
  try {
    streamBusinessDocumentPdf("quote", req.params.id, res);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", (req, res, next) => {
  const quote = getQuote(req.params.id);
  if (!quote) return next(new HttpError(404, "Presupuesto no encontrado"));
  res.json(quote);
});

router.post("/", (req, res, next) => {
  try {
    const body = quoteSchema.parse(req.body);
    const db = getDb();
    const createdId = withTransaction(() => {
      const settings = db
        .prepare(
          "SELECT quote_prefix AS prefix FROM company_settings WHERE id = 1",
        )
        .get() as { prefix: string };
      const number = nextDocumentNumber(
        db,
        "quote",
        settings.prefix,
        body.issueDate,
      );
      const totals = calculateTotals(body.items);
      const result = db
        .prepare(
          `INSERT INTO quotes
        (number, client_id, issue_date, expiry_date, status, notes, subtotal, tax_total, total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          number,
          body.clientId,
          body.issueDate,
          body.expiryDate,
          body.status,
          body.notes,
          totals.subtotal,
          totals.taxTotal,
          totals.total,
        );
      const quoteId = Number(result.lastInsertRowid);
      const insertItem = db.prepare(`INSERT INTO quote_items
        (quote_id, description, quantity, unit_price, tax_rate, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)`);
      body.items.forEach((item, index) => {
        insertItem.run(
          quoteId,
          item.description,
          item.quantity,
          item.unitPrice,
          item.taxRate,
          index,
        );
      });
      return quoteId;
    });
    res.status(201).json(getQuote(createdId));
  } catch (error) {
    next(error);
  }
});

router.put("/:id", (req, res, next) => {
  try {
    const body = quoteSchema.parse(req.body);
    const db = getDb();
    withTransaction(() => {
      const totals = calculateTotals(body.items);
      const result = db
        .prepare(
          `UPDATE quotes SET client_id=?, issue_date=?, expiry_date=?,
        status=?, notes=?, subtotal=?, tax_total=?, total=?, updated_at=datetime('now') WHERE id=?`,
        )
        .run(
          body.clientId,
          body.issueDate,
          body.expiryDate,
          body.status,
          body.notes,
          totals.subtotal,
          totals.taxTotal,
          totals.total,
          req.params.id,
        );
      if (result.changes === 0)
        throw new HttpError(404, "Presupuesto no encontrado");
      db.prepare("DELETE FROM quote_items WHERE quote_id = ?").run(
        req.params.id,
      );
      const insertItem = db.prepare(`INSERT INTO quote_items
        (quote_id, description, quantity, unit_price, tax_rate, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)`);
      body.items.forEach((item, index) => {
        insertItem.run(
          req.params.id,
          item.description,
          item.quantity,
          item.unitPrice,
          item.taxRate,
          index,
        );
      });
    });
    res.json(getQuote(req.params.id));
  } catch (error) {
    next(error);
  }
});

router.post("/:id/convert", (req, res, next) => {
  try {
    const db = getDb();
    const invoiceId = withTransaction(() => {
      const quote = getQuote(req.params.id) as
        | {
            clientId: number;
            issueDate: string;
            notes: string;
            subtotal: number;
            taxTotal: number;
            total: number;
            items: Array<{
              description: string;
              quantity: number;
              unitPrice: number;
              taxRate: number;
            }>;
          }
        | undefined;
      if (!quote) throw new HttpError(404, "Presupuesto no encontrado");
      const existing = db
        .prepare("SELECT id FROM invoices WHERE quote_id = ?")
        .get(req.params.id) as { id: number } | undefined;
      if (existing)
        throw new HttpError(
          409,
          "Este presupuesto ya fue convertido en factura",
        );
      const settings = db
        .prepare(
          `SELECT invoice_prefix AS prefix,
        payment_terms_days AS paymentTermsDays FROM company_settings WHERE id = 1`,
        )
        .get() as { prefix: string; paymentTermsDays: number };
      const issueDate = new Date().toISOString().slice(0, 10);
      const number = nextDocumentNumber(
        db,
        "invoice",
        settings.prefix,
        issueDate,
      );
      const result = db
        .prepare(
          `INSERT INTO invoices
        (number, client_id, quote_id, issue_date, due_date, status, notes,
         subtotal, tax_total, total)
        VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
        )
        .run(
          number,
          quote.clientId,
          req.params.id,
          issueDate,
          addDaysIso(issueDate, settings.paymentTermsDays),
          quote.notes,
          quote.subtotal,
          quote.taxTotal,
          quote.total,
        );
      const createdInvoiceId = Number(result.lastInsertRowid);
      const insertItem = db.prepare(`INSERT INTO invoice_items
        (invoice_id, description, quantity, unit_price, tax_rate, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)`);
      quote.items.forEach((item, index) => {
        insertItem.run(
          createdInvoiceId,
          item.description,
          item.quantity,
          item.unitPrice,
          item.taxRate,
          index,
        );
      });
      db.prepare(
        `UPDATE quotes SET status='accepted', updated_at=datetime('now') WHERE id=?`,
      ).run(req.params.id);
      return createdInvoiceId;
    });
    res.status(201).json({ invoiceId });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", (req, res, next) => {
  const db = getDb();
  const quote = db
    .prepare("SELECT id FROM quotes WHERE id = ?")
    .get(req.params.id);
  if (!quote) return next(new HttpError(404, "Presupuesto no encontrado"));
  const converted = db
    .prepare("SELECT id FROM invoices WHERE quote_id = ?")
    .get(req.params.id);
  if (converted)
    return next(
      new HttpError(
        409,
        "No se puede eliminar un presupuesto convertido en factura",
      ),
    );
  db.prepare("DELETE FROM quotes WHERE id = ?").run(req.params.id);
  res.status(204).send();
});

export { getQuote };
export default router;
