import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "gestor-pyme-test-"));
process.env.NODE_ENV = "test";
process.env.DATABASE_PATH = ":memory:";
process.env.UPLOADS_PATH = tempDir;
process.env.JWT_SECRET = "test-secret-with-enough-length";
process.env.ADMIN_USERNAME = "admin";
process.env.ADMIN_PASSWORD = "test-password-123";
process.env.WEB_ORIGIN = "http://localhost:5173";

const { createApp } = await import("../dist/app.js");
const { closeDb } = await import("../dist/db/index.js");
const app = createApp();
let token = "";
let clientId = 0;
let quoteId = 0;
let invoiceId = 0;

after(() => {
  closeDb();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("health endpoint is public", async () => {
  const response = await request(app).get("/api/health").expect(200);
  assert.equal(response.body.status, "ok");
});

test("protected endpoints reject anonymous requests", async () => {
  await request(app).get("/api/clients").expect(401);
});

test("administrator can authenticate", async () => {
  const response = await request(app)
    .post("/api/auth/login")
    .send({
      username: "admin",
      password: "test-password-123",
    })
    .expect(200);
  assert.ok(response.body.token);
  token = response.body.token;
});

test("creates a client", async () => {
  const response = await request(app)
    .post("/api/clients")
    .set("Authorization", `Bearer ${token}`)
    .send({
      type: "company",
      name: "Cliente Demo SL",
      taxId: "B12345678",
      email: "demo@example.com",
      phone: "600000000",
      address: "Calle Demo 1",
      postalCode: "28001",
      city: "Madrid",
      country: "España",
      notes: "",
    })
    .expect(201);
  assert.equal(response.body.name, "Cliente Demo SL");
  clientId = response.body.id;
});

test("creates a quote and calculates totals on the server", async () => {
  const response = await request(app)
    .post("/api/quotes")
    .set("Authorization", `Bearer ${token}`)
    .send({
      clientId,
      issueDate: "2026-06-17",
      expiryDate: "2026-07-17",
      status: "draft",
      notes: "Prueba",
      items: [
        {
          description: "Consultoría",
          quantity: 2,
          unitPrice: 100,
          taxRate: 21,
        },
      ],
    })
    .expect(201);
  assert.equal(response.body.number, "PRE-2026-0001");
  assert.equal(response.body.subtotal, 200);
  assert.equal(response.body.taxTotal, 42);
  assert.equal(response.body.total, 242);
  quoteId = response.body.id;
});

test("renders the quote as PDF", async () => {
  const response = await request(app)
    .get(`/api/quotes/${quoteId}/pdf`)
    .set("Authorization", `Bearer ${token}`)
    .expect(200);
  assert.match(response.headers["content-type"], /application\/pdf/);
  assert.ok(
    Number(response.headers["content-length"] ?? response.body.length) > 500,
  );
});

test("converts the quote into a single invoice", async () => {
  const response = await request(app)
    .post(`/api/quotes/${quoteId}/convert`)
    .set("Authorization", `Bearer ${token}`)
    .expect(201);
  invoiceId = response.body.invoiceId;
  assert.ok(invoiceId > 0);
  await request(app)
    .post(`/api/quotes/${quoteId}/convert`)
    .set("Authorization", `Bearer ${token}`)
    .expect(409);
});

test("marks invoice as paid and updates dashboard", async () => {
  const invoice = await request(app)
    .patch(`/api/invoices/${invoiceId}/status`)
    .set("Authorization", `Bearer ${token}`)
    .send({ status: "paid" })
    .expect(200);
  assert.equal(invoice.body.status, "paid");
  assert.ok(invoice.body.paidAt);
  const dashboard = await request(app)
    .get("/api/dashboard")
    .set("Authorization", `Bearer ${token}`)
    .expect(200);
  assert.equal(dashboard.body.summary.paidThisYear, 242);
});
