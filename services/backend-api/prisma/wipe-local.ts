/**
 * Wipe ALL local dev data: users, groups, payments, ledger, notifications, etc.
 * Refuses to run unless DATABASE_URL points at localhost (127.0.0.1 / localhost).
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
process.env.MYTURN_LOCAL_DB = "1";
loadPrismaEnv(packageRoot);

function assertLocalDatabaseOnly() {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) {
    throw new Error("[wipe:local] DATABASE_URL is not set.");
  }
  const normalized = raw.replace(/^postgres(ql)?:/i, "http:");
  const host = new URL(normalized).hostname.toLowerCase();
  const allowed =
    host === "127.0.0.1" ||
    host === "localhost" ||
    host === "::1";
  if (!allowed) {
    throw new Error(
      `[wipe:local] Refusing to wipe non-local database (host=${host}). ` +
        "Only 127.0.0.1 / localhost are allowed. Remove .env.railway-public or use MYTURN_LOCAL_DB=1.",
    );
  }
}

const prisma = new PrismaClient();

async function wipe() {
  assertLocalDatabaseOnly();
  console.log("[wipe:local] MyTurn local database wipe");
  logDatabaseUrlHost("[wipe:local]");

  await prisma.$transaction([
    prisma.withdrawalRequest.deleteMany(),
    prisma.ledgerLine.deleteMany(),
    prisma.ledgerTransaction.deleteMany(),
    prisma.ledgerAccount.deleteMany(),
    prisma.paymentRequest.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.contributionGuaranteeReserve.deleteMany(),
    prisma.contribution.deleteMany(),
    prisma.payout.deleteMany(),
    prisma.groupMember.deleteMany(),
    prisma.adminEarning.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.deviceToken.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.ledgerEntry.deleteMany(),
    prisma.reconciliationSnapshot.deleteMany(),
    prisma.wallet.deleteMany(),
    prisma.group.deleteMany(),
    prisma.adminRequest.deleteMany(),
    prisma.user.deleteMany(),
    prisma.setting.deleteMany(),
  ]);

  const counts = {
    users: await prisma.user.count(),
    groups: await prisma.group.count(),
    payments: await prisma.payment.count(),
    ledgerEntries: await prisma.ledgerEntry.count(),
    ledgerAccounts: await prisma.ledgerAccount.count(),
    withdrawals: await prisma.withdrawalRequest.count(),
  };

  console.log("[wipe:local] done — remaining rows:", counts);
  const remaining =
    counts.users +
    counts.groups +
    counts.payments +
    counts.ledgerEntries +
    counts.ledgerAccounts +
    counts.withdrawals;
  if (remaining > 0) {
    throw new Error("[wipe:local] Wipe incomplete.");
  }
  console.log("[wipe:local] Run `npm run db:seed:local` to restore HQ + admin only.");
}

wipe()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("[wipe:local] failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
