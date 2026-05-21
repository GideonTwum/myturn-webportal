"use strict";

const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

/**
 * Load env for Prisma CLI: `.env` first, then merge keys from `.env.railway-public`
 * when that file exists (each key in the second file overrides).
 *
 * @param {string} [packageRoot] - backend-api directory (folder containing `.env`)
 */
function loadPrismaEnv(packageRoot = __dirname) {
  dotenv.config({ path: path.resolve(packageRoot, ".env"), override: true });

  const railwayPath = path.resolve(packageRoot, ".env.railway-public");
  if (!fs.existsSync(railwayPath)) {
    return { railwayPublicLoaded: false };
  }

  const parsed = dotenv.parse(fs.readFileSync(railwayPath, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    process.env[key] = value;
  }
  return { railwayPublicLoaded: true };
}

/**
 * Log connection target without credentials (hostname + port only).
 * @param {string} [prefix]
 */
function logDatabaseUrlHost(prefix = "[prisma-cli]") {
  const raw = process.env.DATABASE_URL;
  if (!raw || typeof raw !== "string") {
    console.error(`${prefix} DATABASE_URL is not set.`);
    return;
  }
  try {
    const normalized = raw.trim().replace(/^postgres(ql)?:/i, "http:");
    const u = new URL(normalized);
    const host = u.hostname;
    const port = u.port || "5432";
    console.error(`${prefix} DATABASE_URL target host ${host}:${port}`);
  } catch {
    console.error(
      `${prefix} DATABASE_URL is set (could not parse host for logging).`,
    );
  }
}

module.exports = { loadPrismaEnv, logDatabaseUrlHost };
