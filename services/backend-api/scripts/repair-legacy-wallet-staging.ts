#!/usr/bin/env ts-node
/**
 * Repair stale legacy Wallet.balance / Wallet.lockedBalance on staging.
 * Dry-run by default. Requires --execute to mutate.
 */
import { PrismaClient } from "@prisma/client";
import { resolve } from "node:path";
import { runLegacyWalletRepair } from "./repair-legacy-wallet-staging.lib";

const {
  loadPrismaEnv,
  logDatabaseUrlHost,
}: {
  loadPrismaEnv: (packageRoot?: string) => { railwayPublicLoaded: boolean };
  logDatabaseUrlHost: (prefix?: string) => void;
} = require("../load-env.cjs");

const EXECUTE = process.argv.includes("--execute");

function assertRepairAllowed(): void {
  const t = process.env.DEPLOYMENT_TIER?.trim().toLowerCase() ?? "local";
  if (t === "production") {
    throw new Error("Refusing legacy wallet repair in production");
  }
  if (t !== "staging" && process.env.MYTURN_STAGING_REPAIR !== "1") {
    throw new Error(
      "Set DEPLOYMENT_TIER=staging or MYTURN_STAGING_REPAIR=1 to run this script",
    );
  }
}

async function main() {
  assertRepairAllowed();
  const packageRoot = resolve(__dirname, "..");
  loadPrismaEnv(packageRoot);
  logDatabaseUrlHost("[repair:legacy-wallet]");
  console.log(`[repair:legacy-wallet] mode=${EXECUTE ? "EXECUTE" : "DRY-RUN"}`);

  const prisma = new PrismaClient();
  try {
    await runLegacyWalletRepair(prisma, EXECUTE);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("[repair:legacy-wallet] failed:", e);
  process.exit(1);
});
