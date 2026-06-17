import type { Response } from "express";
import PDFDocument from "pdfkit";
import { getDb } from "../db/index.js";
import { HttpError } from "../utils/http.js";

const PAGE = { left: 48, right: 547, top: 48, bottom: 760 };

type PdfKind = "quote" | "invoice";
type LineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
};

type BusinessDocument = {
  number: string;
  issueDate: string;
  secondaryDate: string;
  status: string;
  notes: string;
  paymentMethod?: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  clientName: string;
  clientTaxId: string;
  clientAddress: string;
  clientPostalCode: string;
  clientCity: string;
  clientCountry: string;
  clientEmail: string;
  items: LineItem[];
};

type Company = {
  legalName: string;
  taxId: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  iban: string;
  currency: string;
};

function money(value: number, currency: string) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(
    value,
  );
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function getCompany(): Company {
  return getDb()
    .prepare(
      `SELECT legal_name AS legalName, tax_id AS taxId, address,
    postal_code AS postalCode, city, country, email, phone, iban, currency
    FROM company_settings WHERE id=1`,
    )
    .get() as Company;
}

function getDocument(
  kind: PdfKind,
  id: number | string,
): BusinessDocument | undefined {
  const isQuote = kind === "quote";
  const table = isQuote ? "quotes" : "invoices";
  const itemTable = isQuote ? "quote_items" : "invoice_items";
  const foreignKey = isQuote ? "quote_id" : "invoice_id";
  const secondaryColumn = isQuote ? "expiry_date" : "due_date";
  const paymentColumn = isQuote ? "''" : "d.payment_method";

  const document = getDb()
    .prepare(
      `SELECT d.number, d.issue_date AS issueDate,
    d.${secondaryColumn} AS secondaryDate, d.status, d.notes,
    ${paymentColumn} AS paymentMethod, d.subtotal, d.tax_total AS taxTotal, d.total,
    c.name AS clientName, c.tax_id AS clientTaxId, c.address AS clientAddress,
    c.postal_code AS clientPostalCode, c.city AS clientCity, c.country AS clientCountry,
    c.email AS clientEmail
    FROM ${table} d JOIN clients c ON c.id=d.client_id WHERE d.id=?`,
    )
    .get(id) as Omit<BusinessDocument, "items"> | undefined;

  if (!document) return undefined;
  const items = getDb()
    .prepare(
      `SELECT description, quantity, unit_price AS unitPrice,
    tax_rate AS taxRate FROM ${itemTable} WHERE ${foreignKey}=? ORDER BY sort_order, id`,
    )
    .all(id) as LineItem[];
  return { ...document, items };
}

function ensureSpace(pdf: PDFKit.PDFDocument, height: number) {
  if (pdf.y + height <= PAGE.bottom) return;
  pdf.addPage();
  pdf.y = PAGE.top;
}

export function streamBusinessDocumentPdf(
  kind: PdfKind,
  id: number | string,
  res: Response,
) {
  const company = getCompany();
  const document = getDocument(kind, id);
  if (!document)
    throw new HttpError(
      404,
      kind === "quote" ? "Presupuesto no encontrado" : "Factura no encontrada",
    );

  const title = kind === "quote" ? "PRESUPUESTO" : "FACTURA";
  const secondaryLabel = kind === "quote" ? "Válido hasta" : "Vencimiento";
  const pdf = new PDFDocument({
    size: "A4",
    margin: PAGE.left,
    info: { Title: `${title} ${document.number}` },
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${document.number}.pdf"`,
  );
  pdf.pipe(res);

  pdf
    .font("Helvetica-Bold")
    .fontSize(20)
    .text(company.legalName, PAGE.left, PAGE.top, { width: 300 });
  pdf.font("Helvetica").fontSize(9).fillColor("#475569");
  const companyLines = [
    company.taxId,
    company.address,
    [company.postalCode, company.city].filter(Boolean).join(" "),
    company.country,
    company.email,
    company.phone,
  ].filter(Boolean);
  pdf.text(companyLines.join("\n"), PAGE.left, 78, { width: 290, lineGap: 2 });

  pdf
    .fillColor("#0f172a")
    .font("Helvetica-Bold")
    .fontSize(24)
    .text(title, 350, PAGE.top, { width: 197, align: "right" });
  pdf.font("Helvetica").fontSize(10).fillColor("#334155");
  pdf.text(document.number, 350, 82, { width: 197, align: "right" });
  pdf.text(`Fecha: ${formatDate(document.issueDate)}`, 350, 100, {
    width: 197,
    align: "right",
  });
  pdf.text(
    `${secondaryLabel}: ${formatDate(document.secondaryDate)}`,
    350,
    116,
    { width: 197, align: "right" },
  );

  pdf
    .moveTo(PAGE.left, 150)
    .lineTo(PAGE.right, 150)
    .strokeColor("#cbd5e1")
    .stroke();

  pdf
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#0f172a")
    .text("CLIENTE", PAGE.left, 170);
  pdf.font("Helvetica").fontSize(10).fillColor("#334155");
  const clientLines = [
    document.clientName,
    document.clientTaxId,
    document.clientAddress,
    [document.clientPostalCode, document.clientCity].filter(Boolean).join(" "),
    document.clientCountry,
    document.clientEmail,
  ].filter(Boolean);
  pdf.text(clientLines.join("\n"), PAGE.left, 190, { width: 300, lineGap: 2 });

  let y = Math.max(pdf.y + 24, 280);
  const columns = {
    description: PAGE.left,
    quantity: 330,
    price: 390,
    tax: 465,
    total: 507,
  };
  pdf.rect(PAGE.left, y, PAGE.right - PAGE.left, 24).fill("#0f172a");
  pdf.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8);
  pdf.text("CONCEPTO", columns.description + 8, y + 8, { width: 260 });
  pdf.text("CANT.", columns.quantity, y + 8, { width: 45, align: "right" });
  pdf.text("PRECIO", columns.price, y + 8, { width: 60, align: "right" });
  pdf.text("IVA", columns.tax, y + 8, { width: 35, align: "right" });
  pdf.text("TOTAL", columns.total, y + 8, { width: 40, align: "right" });
  y += 24;

  for (const item of document.items) {
    const lineTotal = item.quantity * item.unitPrice * (1 + item.taxRate / 100);
    const rowHeight = Math.max(
      30,
      pdf.heightOfString(item.description, { width: 265 }) + 14,
    );
    if (y + rowHeight > PAGE.bottom - 120) {
      pdf.addPage();
      y = PAGE.top;
    }
    pdf.rect(PAGE.left, y, PAGE.right - PAGE.left, rowHeight).fill("#f8fafc");
    pdf.fillColor("#0f172a").font("Helvetica").fontSize(8.5);
    pdf.text(item.description, columns.description + 8, y + 8, { width: 265 });
    pdf.text(String(item.quantity), columns.quantity, y + 8, {
      width: 45,
      align: "right",
    });
    pdf.text(money(item.unitPrice, company.currency), columns.price, y + 8, {
      width: 60,
      align: "right",
    });
    pdf.text(`${item.taxRate}%`, columns.tax, y + 8, {
      width: 35,
      align: "right",
    });
    pdf.text(money(lineTotal, company.currency), columns.total, y + 8, {
      width: 40,
      align: "right",
    });
    y += rowHeight + 2;
  }

  ensureSpace(pdf, 130);
  y = Math.max(y + 14, pdf.y + 14);
  const totalsX = 365;
  pdf.fontSize(10).fillColor("#334155");
  pdf.text("Base imponible", totalsX, y, { width: 90 });
  pdf.text(money(document.subtotal, company.currency), 455, y, {
    width: 92,
    align: "right",
  });
  y += 20;
  pdf.text("Impuestos", totalsX, y, { width: 90 });
  pdf.text(money(document.taxTotal, company.currency), 455, y, {
    width: 92,
    align: "right",
  });
  y += 22;
  pdf.rect(totalsX, y - 5, 182, 30).fill("#e2e8f0");
  pdf.fillColor("#0f172a").font("Helvetica-Bold").fontSize(12);
  pdf.text("TOTAL", totalsX + 8, y + 4, { width: 70 });
  pdf.text(money(document.total, company.currency), 450, y + 4, {
    width: 89,
    align: "right",
  });

  let footerY = y + 55;
  if (kind === "invoice" && (document.paymentMethod || company.iban)) {
    ensureSpace(pdf, 70);
    footerY = Math.max(footerY, pdf.y + 20);
    pdf
      .font("Helvetica-Bold")
      .fontSize(9)
      .text("FORMA DE PAGO", PAGE.left, footerY);
    pdf.font("Helvetica").fontSize(9).fillColor("#334155");
    const payment = [
      document.paymentMethod,
      company.iban ? `IBAN: ${company.iban}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    pdf.text(payment, PAGE.left, footerY + 16, { width: 499 });
    footerY += 45;
  }

  if (document.notes) {
    ensureSpace(pdf, 80);
    footerY = Math.max(footerY, pdf.y + 16);
    pdf
      .fillColor("#0f172a")
      .font("Helvetica-Bold")
      .fontSize(9)
      .text("OBSERVACIONES", PAGE.left, footerY);
    pdf
      .fillColor("#334155")
      .font("Helvetica")
      .fontSize(9)
      .text(document.notes, PAGE.left, footerY + 16, { width: 499 });
  }

  pdf.end();
}
