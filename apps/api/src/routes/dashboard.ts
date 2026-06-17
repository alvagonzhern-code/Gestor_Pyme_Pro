import { Router } from "express";
import { getDb } from "../db/index.js";
import { refreshOverdueInvoices } from "./invoices.js";

const router = Router();

router.get("/", (_req, res) => {
  refreshOverdueInvoices();
  const db = getDb();
  const summary = db
    .prepare(
      `SELECT
    (SELECT COUNT(*) FROM clients) AS clientCount,
    (SELECT COUNT(*) FROM quotes WHERE status IN ('draft','sent')) AS openQuoteCount,
    (SELECT COALESCE(SUM(total), 0) FROM quotes WHERE status IN ('draft','sent')) AS openQuoteValue,
    (SELECT COUNT(*) FROM invoices WHERE status IN ('sent','overdue')) AS pendingInvoiceCount,
    (SELECT COALESCE(SUM(total), 0) FROM invoices WHERE status IN ('sent','overdue')) AS pendingInvoiceValue,
    (SELECT COALESCE(SUM(total), 0) FROM invoices WHERE status='paid' AND substr(paid_at,1,4)=strftime('%Y','now')) AS paidThisYear,
    (SELECT COUNT(*) FROM invoices WHERE status='overdue') AS overdueCount,
    (SELECT COALESCE(SUM(total), 0) FROM invoices WHERE status='overdue') AS overdueValue
  `,
    )
    .get();

  const recentInvoices = db
    .prepare(
      `SELECT i.id, i.number, c.name AS clientName,
    i.issue_date AS issueDate, i.due_date AS dueDate, i.status, i.total
    FROM invoices i JOIN clients c ON c.id=i.client_id
    ORDER BY i.created_at DESC LIMIT 5`,
    )
    .all();

  const recentQuotes = db
    .prepare(
      `SELECT q.id, q.number, c.name AS clientName,
    q.issue_date AS issueDate, q.expiry_date AS expiryDate, q.status, q.total
    FROM quotes q JOIN clients c ON c.id=q.client_id
    ORDER BY q.created_at DESC LIMIT 5`,
    )
    .all();

  const monthlyRevenue = db
    .prepare(
      `WITH RECURSIVE months(n) AS (
      SELECT 0 UNION ALL SELECT n + 1 FROM months WHERE n < 5
    )
    SELECT strftime('%Y-%m', date('now', '-' || n || ' months')) AS month,
      COALESCE((SELECT SUM(total) FROM invoices
        WHERE status='paid' AND substr(paid_at,1,7)=strftime('%Y-%m', date('now', '-' || n || ' months'))), 0) AS total
    FROM months ORDER BY month`,
    )
    .all();

  res.json({ summary, recentInvoices, recentQuotes, monthlyRevenue });
});

export default router;
