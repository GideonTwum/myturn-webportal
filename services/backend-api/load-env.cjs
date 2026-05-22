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

  const forceLocal =
    process.env.MYTURN_LOCAL_DB === "1" ||
    process.env.MYTURN_LOCAL_DB === "true";
  if (forceLocal) {
    return { railwayPublicLoaded: false, forcedLocal: true };
  }

  const railwayPath = path.resolve(packageRoot, ".env.railway-public");
  if (!fs.existsSync(railwayPath)) {
    return { railwayPublicLoaded: false };
  }

  const parsed = dotenv.parse(fs.readFileSync(railwayPath, "utf8"));
  for (const [key, value] of Object.entries(parsed)) {
    process.env[key] = value;
  }
  assertLaptopReachableDatabaseUrl();
  return { railwayPublicLoaded: true };
}

/**
 * `.env.railway-public` is for Prisma from your laptop. Railway's private host
 * `postgres.railway.internal` only resolves inside Railway — not on your PC.
 */
function assertLaptopReachableDatabaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw || typeof raw !== "string") return;
  try {
    const normalized = raw.trim().replace(/^postgres(ql)?:/i, "http:");
    const host = new URL(normalized).hostname;
    if (host === "postgres.railway.internal" || host.endsWith(".railway.internal")) {
      console.error(
        "[prisma-cli] DATABASE_URL uses a Railway *private* host (" +
          host +
          ").",
      );
      console.error(
        "[prisma-cli] From your laptop, use the *public* URL instead:",
      );
      console.error(
        "[prisma-cli]   Railway → Postgres service → Connect → Public Network → copy URL",
      );
      console.error(
        "[prisma-cli] Put that in services/backend-api/.env.railway-public (host is usually *.proxy.rlwy.net, port often not 5432).",
      );
      console.error(
        "[prisma-cli] Keep postgres.railway.internal only on the deployed API service variables.",
      );
      process.exit(1);
    }
  } catch {
    /* parse errors surface later from Prisma */
  }
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
