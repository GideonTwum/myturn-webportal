"use strict";

const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { PrismaClient } = require("@prisma/client");

const railwayPath = path.resolve(__dirname, "../.env.railway-public");
const parsed = dotenv.parse(fs.readFileSync(railwayPath, "utf8"));
const raw = parsed.DATABASE_URL;
const lines = fs
  .readFileSync(railwayPath, "utf8")
  .split(/\r?\n/)
  .filter((l) => l.trim().startsWith("DATABASE_URL="));

const urls = lines.map((l) => l.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, ""));

async function tryUrl(label, url) {
  const withSsl = url.includes("sslmode=")
    ? url
    : `${url}${url.includes("?") ? "&" : "?"}sslmode=require`;
  const host = new URL(withSsl.replace(/^postgres(ql)?:/i, "http:")).host;
  const prisma = new PrismaClient({ datasources: { db: { url: withSsl } } });
  try {
    await prisma.$queryRaw`SELECT 1 AS ok`;
    console.log(`OK  ${label} ${host}`);
    return true;
  } catch (e) {
    console.log(`FAIL ${label} ${host}`);
    console.log(`     ${(e.message || String(e)).split("\n")[0]}`);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

(async () => {
  console.log(`[test] ${lines.length} DATABASE_URL line(s) in .env.railway-public`);
  console.log(`[test] Effective after dotenv parse: ${raw ? new URL(raw.replace(/^postgres(ql)?:/i, "http:")).host : "none"}`);
  let anyOk = false;
  for (let i = 0; i < urls.length; i++) {
    anyOk = (await tryUrl(`line${i + 1}`, urls[i])) || anyOk;
  }
  process.exit(anyOk ? 0 : 1);
})();
