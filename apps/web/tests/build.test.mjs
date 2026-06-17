import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspace = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const dist = path.join(workspace, "dist");

test("production build contains an application shell and assets", () => {
  const htmlPath = path.join(dist, "index.html");
  assert.ok(
    fs.existsSync(htmlPath),
    "Debe ejecutarse npm run build antes de la prueba",
  );
  const html = fs.readFileSync(htmlPath, "utf8");
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /assets\/.*\.js/);
  const assets = fs.readdirSync(path.join(dist, "assets"));
  assert.ok(assets.some((file) => file.endsWith(".css")));
  assert.ok(
    assets.filter((file) => file.endsWith(".js")).length >= 5,
    "Se esperan chunks separados por ruta",
  );
});
