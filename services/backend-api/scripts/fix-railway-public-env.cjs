"use strict";

const fs = require("node:fs");
const path = require("node:path");

const file = path.resolve(__dirname, "../.env.railway-public");
if (!fs.existsSync(file)) {
  console.error("[fix] .env.railway-public not found");
  process.exit(1);
}

const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
const other = [];
const dbUrls = [];

for (const line of lines) {
  const t = line.trim();
  if (t.startsWith("DATABASE_URL=")) {
    let v = t.slice("DATABASE_URL=".length).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    dbUrls.push(v);
  } else {
    other.push(line);
  }
}

if (dbUrls.length === 0) {
  console.error("[fix] No DATABASE_URL in .env.railway-public");
  process.exit(1);
}

let url = dbUrls[dbUrls.length - 1];
if (!/sslmode=/i.test(url)) {
  url = `${url}${url.includes("?") ? "&" : "?"}sslmode=require`;
}

const host = new URL(url.replace(/^postgres(ql)?:/i, "http:")).host;
const out = [...other.filter((l) => l.trim().length > 0), `DATABASE_URL="${url}"`, ""].join("\n");
fs.writeFileSync(file, out, "utf8");
console.log(`[fix] Wrote one DATABASE_URL (${host}, sslmode=require). Removed ${dbUrls.length - 1} duplicate(s).`);
