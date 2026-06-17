import { Router } from "express";
import { z } from "zod";
import { getDb } from "../db/index.js";

const router = Router();

const settingsSchema = z.object({
  legalName: z.string().trim().min(1).max(160),
  taxId: z.string().trim().max(40).default(""),
  address: z.string().trim().max(200).default(""),
  postalCode: z.string().trim().max(20).default(""),
  city: z.string().trim().max(100).default(""),
  country: z.string().trim().max(100).default("España"),
  email: z.string().trim().email().or(z.literal("")).default(""),
  phone: z.string().trim().max(40).default(""),
  iban: z.string().trim().max(50).default(""),
  currency: z.string().trim().length(3).default("EUR"),
  quotePrefix: z.string().trim().min(1).max(10),
  invoicePrefix: z.string().trim().min(1).max(10),
  defaultTax: z.number().min(0).max(100),
  paymentTermsDays: z.number().int().min(0).max(365),
});

function getSettings() {
  return getDb()
    .prepare(
      `SELECT legal_name AS legalName, tax_id AS taxId, address,
      postal_code AS postalCode, city, country, email, phone, iban, currency,
      quote_prefix AS quotePrefix, invoice_prefix AS invoicePrefix,
      default_tax AS defaultTax, payment_terms_days AS paymentTermsDays,
      updated_at AS updatedAt
      FROM company_settings WHERE id = 1`,
    )
    .get();
}

router.get("/", (_req, res) => {
  res.json(getSettings());
});

router.put("/", (req, res, next) => {
  try {
    const body = settingsSchema.parse(req.body);
    getDb()
      .prepare(
        `UPDATE company_settings SET
        legal_name = @legalName, tax_id = @taxId, address = @address,
        postal_code = @postalCode, city = @city, country = @country,
        email = @email, phone = @phone, iban = @iban, currency = @currency,
        quote_prefix = @quotePrefix, invoice_prefix = @invoicePrefix,
        default_tax = @defaultTax, payment_terms_days = @paymentTermsDays,
        updated_at = datetime('now') WHERE id = 1`,
      )
      .run(body);
    res.json(getSettings());
  } catch (error) {
    next(error);
  }
});

export default router;
