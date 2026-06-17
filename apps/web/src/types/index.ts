export type Client = {
  id: number;
  type: "company" | "person";
  name: string;
  taxId: string;
  email: string;
  phone: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type LineItem = {
  id?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
};

export type QuoteStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired";
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

export type Quote = {
  id: number;
  number: string;
  clientId: number;
  clientName: string;
  issueDate: string;
  expiryDate: string;
  status: QuoteStatus;
  notes: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  items?: LineItem[];
  createdAt: string;
  updatedAt: string;
};

export type Invoice = {
  id: number;
  number: string;
  clientId: number;
  clientName: string;
  quoteId?: number | null;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  notes: string;
  paymentMethod: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  paidAt?: string | null;
  items?: LineItem[];
  createdAt: string;
  updatedAt: string;
};

export type CompanySettings = {
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
  quotePrefix: string;
  invoicePrefix: string;
  defaultTax: number;
  paymentTermsDays: number;
  updatedAt?: string;
};

export type ManagedDocument = {
  id: number;
  clientId?: number | null;
  clientName?: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  category: string;
  notes: string;
  uploadedAt: string;
};
