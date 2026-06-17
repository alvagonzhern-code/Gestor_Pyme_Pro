import { Router } from "express";
import { z } from "zod";
import { getDb, withTransaction } from "../db/index.js";
import { calculateTotals } from "../utils/money.js";
import { nextDocumentNumber } from "../utils/numbering.js";
import { HttpError } from "../utils/http.js";
import { streamBusinessDocumentPdf } from "../services/pdf.js";

const router = Router();

const itemSchema = z.object({
  description: z.string().trim().min(1).max(500),
  quantity: z.number().positive().max(1_000_000),
  unitPrice: z.number().min(0).max(1_000_000_000),
  taxRate: z.number().min(0).max(100),
});

const invoiceSchema = z.object({
  clientId: z.number().int().positive(),
  issueDate: z.string().date(),
  dueDate: z.string().date(),
  status: z
    .enum(["draft", "sent", "paid", "overdue", "cancelled"])
    .default("draft"),
  notes: z.string().trim().max(5000).default(""),
  paymentMethod: z.string().trim().max(200).default("Transferencia bancaria"),
  items: z.array(itemSchema).min(1).max(100),
});

const invoiceListSql = `SELECT i.id, i.number, i.client_id AS clientId, c.name AS clientName,
  i.quote_id AS quoteId, i.issue_date AS issueDate, i.due_date AS dueDate,
  i.status, i.notes, i.payment_method AS paymentMethod,
  i.subtotal, i.tax_total AS taxTotal, i.total, i.paid_at AS paidAt,
  i.created_at AS createdAt, i.updated_at AS updatedAt
  FROM invoices i JOIN clients c ON c.id = i.client_id`;

export function refreshOverdueInvoices() {
  getDb()
    .prepare(
      `UPDATE invoices SET status='overdue', updated_at=datetime('now')
    WHERE status='sent' AND due_date < date('now')`,
    )
    .run();
}

export function getInvoice(id: number | string) {
  refreshOverdueInvoices();
  const db = getDb();
  const invoice = db.prepare(`${invoiceListSql} WHERE i.id = ?`).get(id) as
    | Record<string, unknown>
    | undefined;
  if (!invoice) return undefined;
  const items = db
    .prepare(
      `SELECT id, description, quantity, unit_price AS unitPrice,
    tax_rate AS taxRate, sort_order AS sortOrder FROM invoice_items
    WHERE invoice_id = ? ORDER BY sort_order, id`,
    )
    .all(id);
  return { ...invoice, items };
}

router.get("/", (req, res) => {
  refreshOverdueInvoices();
  const status = String(req.query.status ?? "").trim();
  const search = String(req.query.search ?? "").trim();
  const clauses: string[] = [];
  const params: string[] = [];
  if (status) {
    clauses.push("i.status = ?");
    params.push(status);
  }
  if (search) {
    clauses.push("(i.number LIKE ? OR c.name LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
  const rows = getDb()
    .prepare(`${invoiceListSql}${where} ORDER BY i.issue_date DESC, i.id DESC`)
    .all(...params);
  res.json(rows);
});

router.get("/:id/pdf", (req, res, next) => {
  try {
    streamBusinessDocumentPdf("invoice", req.params.id, res);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", (req, res, next) => {
  const invoice = getInvoice(req.params.id);
  if (!invoice) return next(new HttpError(404, "Factura no encontrada"));
  res.json(invoice);
});

router.post("/", (req, res, next) => {
  try {
    const body = invoiceSchema.parse(req.body);
    const db = getDb();
    const createdId = withTransaction(() => {
      const settings = db
        .prepare(
          "SELECT invoice_prefix AS prefix FROM company_settings WHERE id = 1",
        )
        .get() as { prefix: string };
      const number = nextDocumentNumber(
        db,
        "invoice",
        settings.prefix,
        body.issueDate,
      );
      const totals = calculateTotals(body.items);
      const paidAt = body.status === "paid" ? new Date().toISOString() : null;
      const result = db
        .prepare(
          `INSERT INTO invoices
        (number, client_id, issue_date, due_date, status, notes, payment_method,
         subtotal, tax_total, total, paid_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          number,
          body.clientId,
          body.issueDate,
          body.dueDate,
          body.status,
          body.notes,
          body.paymentMethod,
          totals.subtotal,
          totals.taxTotal,
          totals.total,
          paidAt,
        );
      const invoiceId = Number(result.lastInsertRowid);
      const insertItem = db.prepare(`INSERT INTO invoice_items
        (invoice_id, description, quantity, unit_price, tax_rate, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)`);
      body.items.forEach((item, index) => {
        insertItem.run(
          invoiceId,
          item.description,
          item.quantity,
          item.unitPrice,
          item.taxRate,
          index,
        );
      });
      return invoiceId;
    });
    res.status(201).json(getInvoice(createdId));
  } catch (error) {
    next(error);
  }
});

router.put("/:id", (req, res, next) => {
  try {
    const body = invoiceSchema.parse(req.body);
    const db = getDb();
    withTransaction(() => {
      const totals = calculateTotals(body.items);
      const current = db
        .prepare("SELECT status, paid_at AS paidAt FROM invoices WHERE id = ?")
        .get(req.params.id) as
        | { status: string; paidAt: string | null }
        | undefined;
      if (!current) throw new HttpError(404, "Factura no encontrada");
      const paidAt =
        body.status === "paid"
          ? (current.paidAt ?? new Date().toISOString())
          : null;
      db.prepare(
        `UPDATE invoices SET client_id=?, issue_date=?, due_date=?, status=?,
        notes=?, payment_method=?, subtotal=?, tax_total=?, total=?, paid_at=?,
        updated_at=datetime('now') WHERE id=?`,
      ).run(
        body.clientId,
        body.issueDate,
        body.dueDate,
        body.status,
        body.notes,
        body.paymentMethod,
        totals.subtotal,
        totals.taxTotal,
        totals.total,
        paidAt,
        req.params.id,
      );
      db.prepare("DELETE FROM invoice_items WHERE invoice_id = ?").run(
        req.params.id,
      );
      const insertItem = db.prepare(`INSERT INTO invoice_items
        (invoice_id, description, quantity, unit_price, tax_rate, sort_order)
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
    res.json(getInvoice(req.params.id));
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/status", (req, res, next) => {
  try {
    const body = z
      .object({
        status: z.enum(["draft", "sent", "paid", "overdue", "cancelled"]),
      })
      .parse(req.body);
    const paidAt = body.status === "paid" ? new Date().toISOString() : null;
    const result = getDb()
      .prepare(
        `UPDATE invoices SET status=?, paid_at=?,
      updated_at=datetime('now') WHERE id=?`,
      )
      .run(body.status, paidAt, req.params.id);
    if (result.changes === 0) throw new HttpError(404, "Factura no encontrada");
    res.json(getInvoice(req.params.id));
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", (req, res, next) => {
  const current = getDb()
    .prepare("SELECT status FROM invoices WHERE id = ?")
    .get(req.params.id) as { status: string } | undefined;
  if (!current) return next(new HttpError(404, "Factura no encontrada"));
  if (current.status === "paid")
    return next(
      new HttpError(
        409,
        "No se puede eliminar una factura pagada; cancélala para conservar la trazabilidad",
      ),
    );
  getDb().prepare("DELETE FROM invoices WHERE id = ?").run(req.params.id);
  res.status(204).send();
});

export default router;
