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

function assertStagingWipeAllowed(railwayPublicLoaded: boolean) {
  if (process.env.MYTURN_CONFIRM_STAGING_WIPE?.trim().toLowerCase() !== "yes") {
    throw new Error(
      "[wipe:staging:railway] Refusing to run. Set MYTURN_CONFIRM_STAGING_WIPE=yes to confirm.",
    );
  }
  if (!railwayPublicLoaded) {
    const localForced =
      process.env.MYTURN_LOCAL_DB === "1" ||
      process.env.MYTURN_LOCAL_DB === "true";
    throw new Error(
      localForced
        ? "[wipe:staging:railway] MYTURN_LOCAL_DB is set — unset it to target Railway (.env.railway-public)."
        : "[wipe:staging:railway] Missing services/backend-api/.env.railway-public with PUBLIC DATABASE_URL.",
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

async function withDbRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const attempts = 4;
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const msg = e instanceof Error ? e.message : String(e);
      const retryable =
        msg.includes("Can't reach database") || msg.includes("P1001");
      if (!retryable || i === attempts - 1) throw e;
      const waitMs = 2500 * (i + 1);
      console.log(
        `[wipe:staging:railway] ${label} failed (attempt ${i + 1}/${attempts}), retrying in ${waitMs}ms…`,
      );
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw last;
}

async function wipe() {
  delete process.env.MYTURN_LOCAL_DB;
  const { railwayPublicLoaded } = loadPrismaEnv(packageRoot);
  assertStagingWipeAllowed(railwayPublicLoaded);
  console.log("[wipe:staging:railway] MyTurn Railway staging data wipe");
  logDatabaseUrlHost("[wipe:staging:railway]");

  const prisma = new PrismaClient();
  try {
    await withDbRetry("connect", () => prisma.$queryRaw`SELECT 1`);

    const steps = [
      () => prisma.withdrawalRequest.deleteMany(),
      () => prisma.ledgerLine.deleteMany(),
      () => prisma.ledgerTransaction.deleteMany(),
      () => prisma.ledgerAccount.deleteMany(),
      () => prisma.paymentRequest.deleteMany(),
      () => prisma.payment.deleteMany(),
      () => prisma.contribution.deleteMany(),
      () => prisma.payout.deleteMany(),
      () => prisma.groupMember.deleteMany(),
      () => prisma.adminEarning.deleteMany(),
      () => prisma.notification.deleteMany(),
      () => prisma.deviceToken.deleteMany(),
      () => prisma.auditLog.deleteMany(),
      () => prisma.ledgerEntry.deleteMany(),
      () => prisma.wallet.deleteMany(),
      () => prisma.group.deleteMany(),
      () => prisma.adminRequest.deleteMany(),
      () => prisma.user.deleteMany(),
      () => prisma.setting.deleteMany(),
    ];

    for (const step of steps) {
      await withDbRetry("delete", step);
    }

    const counts = {
      users: await prisma.user.count(),
      groups: await prisma.group.count(),
      ledgerAccounts: await prisma.ledgerAccount.count(),
      withdrawals: await prisma.withdrawalRequest.count(),
    };
    console.log("[wipe:staging:railway] done — remaining rows:", counts);
    const remaining =
      counts.users +
      counts.groups +
      counts.ledgerAccounts +
      counts.withdrawals;
    if (remaining > 0) {
      throw new Error("[wipe:staging:railway] Wipe incomplete.");
    }
    console.log(
      "[wipe:staging:railway] Repopulate: npm run db:seed (HQ + admin only)",
    );
  } finally {
    await prisma.$disconnect();
  }
}

wipe().catch((e) => {
  console.error("[wipe:staging:railway] failed:", e);
  process.exit(1);
});
