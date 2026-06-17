import type { DatabaseSync } from "node:sqlite";

export function nextDocumentNumber(
  db: DatabaseSync,
  kind: "quote" | "invoice",
  prefix: string,
  issueDate: string,
): string {
  const year = Number(issueDate.slice(0, 4));
  db.prepare(
    `INSERT INTO counters (kind, year, last_value) VALUES (?, ?, 1)
     ON CONFLICT(kind, year) DO UPDATE SET last_value = last_value + 1`,
  ).run(kind, year);
  const row = db
    .prepare("SELECT last_value FROM counters WHERE kind = ? AND year = ?")
    .get(kind, year) as { last_value: number };
  return `${prefix}-${year}-${String(row.last_value).padStart(4, "0")}`;
}
