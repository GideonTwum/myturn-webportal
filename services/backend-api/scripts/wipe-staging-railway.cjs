"use strict";

/**
 * Wipe Railway staging Postgres from your laptop (.env.railway-public).
 * Uses `prisma db execute` (same connection path as migrate deploy / db seed).
 * Requires MYTURN_CONFIRM_STAGING_WIPE=yes
 */
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  loadPrismaEnv,
  logDatabaseUrlHost,
} = require("../load-env.cjs");

const packageRoot = path.resolve(__dirname, "..");

function assertAllowed(railwayPublicLoaded) {
  if (process.env.MYTURN_CONFIRM_STAGING_WIPE?.trim().toLowerCase() !== "yes") {
    console.error(
      "[wipe:staging:railway] Refusing to run. Set MYTURN_CONFIRM_STAGING_WIPE=yes to confirm.",
    );
    process.exit(1);
  }
  if (!railwayPublicLoaded) {
    const localForced =
      process.env.MYTURN_LOCAL_DB === "1" ||
      process.env.MYTURN_LOCAL_DB === "true";
    console.error(
      localForced
        ? "[wipe:staging:railway] MYTURN_LOCAL_DB is set — unset it to target Railway."
        : "[wipe:staging:railway] Missing services/backend-api/.env.railway-public",
    );
    process.exit(1);
  }
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) {
    console.error("[wipe:staging:railway] DATABASE_URL is not set.");
    process.exit(1);
  }
  const host = new URL(raw.replace(/^postgres(ql)?:/i, "http:")).hostname.toLowerCase();
  if (host === "127.0.0.1" || host === "localhost" || host === "::1") {
    console.error(
      "[wipe:staging:railway] DATABASE_URL looks local. Use npm run db:wipe:local instead.",
    );
    process.exit(1);
  }
}

delete process.env.MYTURN_LOCAL_DB;
const { railwayPublicLoaded } = loadPrismaEnv(packageRoot);
assertAllowed(railwayPublicLoaded);

console.log("[wipe:staging:railway] MyTurn Railway staging data wipe");
logDatabaseUrlHost("[wipe:staging:railway]");

const sqlFile = path.join(packageRoot, "prisma", "wipe-staging-data.sql");
const schema = path.join(packageRoot, "prisma", "schema.prisma");
const prismaEntry = require.resolve("prisma/build/index.js");

const exitCode =
  spawnSync(process.execPath, [prismaEntry, "db", "execute", "--file", sqlFile, "--schema", schema], {
    stdio: "inherit",
    env: process.env,
    cwd: packageRoot,
  }).status ?? 1;

if (exitCode === 0) {
  console.log(
    "[wipe:staging:railway] done — run `npm run db:seed` to restore HQ + admin only.",
  );
}
process.exit(exitCode);
