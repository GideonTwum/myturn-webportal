/**
 * Wipe ALL rows in Railway staging Postgres (from laptop via .env.railway-public).
 * Does not drop tables — use `prisma migrate reset` only if you need a full schema reset.
 *
 * Requires: MYTURN_CONFIRM_STAGING_WIPE=yes
 */
import { PrismaClient } from "@prisma/client";
import { resolve } from "node:path";

const {
  loadPrismaEnv,
  logDatabaseUrlHost,
}: {
  loadPrismaEnv: (packageRoot?: string) => void;
  logDatabaseUrlHost: (prefix?: string) => void;
} = require("../load-env.cjs");

const packageRoot = resolve(__dirname, "..");
const { railwayPublicLoaded } = loadPrismaEnv(packageRoot);

function assertStagingWipeAllowed() {
  if (process.env.MYTURN_CONFIRM_STAGING_WIPE?.trim().toLowerCase() !== "yes") {
    throw new Error(
      "[wipe:staging:railway] Refusing to run. Set MYTURN_CONFIRM_STAGING_WIPE=yes to confirm.",
    );
  }
  if (!railwayPublicLoaded) {
    throw new Error(
      "[wipe:staging:railway] Missing services/backend-api/.env.railway-public with PUBLIC DATABASE_URL.",
    );
  }
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) {
    throw new Error("[wipe:staging:railway] DATABASE_URL is not set.");
  }
  const normalized = raw.replace(/^postgres(ql)?:/i, "http:");
  const host = new URL(normalized).hostname.toLowerCase();
  const local =
    host === "127.0.0.1" || host === "localhost" || host === "::1";
  if (local) {
    throw new Error(
      "[wipe:staging:railway] DATABASE_URL looks local. Use npm run db:wipe:local instead.",
    );
  }
  const railwayLike =
    host.includes("rlwy.net") ||
    host.includes("railway") ||
    host.endsWith(".proxy.rlwy.net");
  if (!railwayLike) {
    throw new Error(
      `[wipe:staging:railway] Refusing unknown host "${host}". Expected Railway public Postgres (*.rlwy.net).`,
    );
  }
}

const prisma = new PrismaClient();

async function wipe() {
  assertStagingWipeAllowed();
  console.log("[wipe:staging:railway] MyTurn Railway staging data wipe");
  logDatabaseUrlHost("[wipe:staging:railway]");

  await prisma.$transaction([
    prisma.paymentRequest.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.contribution.deleteMany(),
    prisma.payout.deleteMany(),
    prisma.groupMember.deleteMany(),
    prisma.adminEarning.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.deviceToken.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.ledgerEntry.deleteMany(),
    prisma.wallet.deleteMany(),
    prisma.group.deleteMany(),
    prisma.adminRequest.deleteMany(),
    prisma.user.deleteMany(),
    prisma.setting.deleteMany(),
  ]);

  const counts = {
    users: await prisma.user.count(),
    groups: await prisma.group.count(),
  };
  console.log("[wipe:staging:railway] done — remaining rows:", counts);
  if (counts.users + counts.groups > 0) {
    throw new Error("[wipe:staging:railway] Wipe incomplete.");
  }
  console.log(
    "[wipe:staging:railway] Repopulate: npm run db:seed && npm run seed:staging:railway",
  );
}

wipe()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("[wipe:staging:railway] failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
