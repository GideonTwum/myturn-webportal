"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  loadPrismaEnv,
  logDatabaseUrlHost,
} = require("../load-env.cjs");

const packageRoot = path.resolve(__dirname, "..");
const { railwayPublicLoaded } = loadPrismaEnv(packageRoot);

console.error(
  railwayPublicLoaded
    ? "[prisma-cli] Loaded .env, then merged .env.railway-public (keys in the second file override)."
    : "[prisma-cli] Loaded .env only (.env.railway-public not found).",
);
logDatabaseUrlHost();

const prismaEntry = require.resolve("prisma/build/index.js");

const exitCode =
  spawnSync(process.execPath, [prismaEntry, ...process.argv.slice(2)], {
    stdio: "inherit",
    env: process.env,
  }).status ?? 1;

process.exit(exitCode);
