/**
 * Legacy Wallet repair helpers — import-safe for tests.
 */
import { LedgerAccountType, Prisma, PrismaClient } from "@prisma/client";

export type StaleWalletRow = {
  userId: string;
  balance: string;
  lockedBalance: string;
};

export type RepairAction =
  | { kind: "zero_locked"; userId: string; reason: string }
  | { kind: "migrate_locked"; userId: string; amount: string; reason: string }
  | { kind: "zero_balance"; userId: string; reason: string }
  | { kind: "migrate_balance"; userId: string; amount: string; reason: string }
  | { kind: "skip"; userId: string; reason: string };

const THRESHOLD = new Prisma.Decimal("0.01");

async function getOrCreateLedgerAccount(
  tx: Prisma.TransactionClient,
  accountKey: string,
  accountType: LedgerAccountType,
  userId?: string,
) {
  const existing = await tx.ledgerAccount.findUnique({ where: { accountKey } });
  if (existing) return existing;
  return tx.ledgerAccount.create({
    data: {
      accountKey,
      accountType,
      userId: userId ?? null,
      currency: "GHS",
      balance: 0,
    },
  });
}

async function postTransferInTx(
  tx: Prisma.TransactionClient,
  params: {
    idempotencyKey: string;
    referenceType: string;
    referenceId: string;
    description: string;
    metadata?: Prisma.InputJsonValue;
    fromAccountId: string;
    toAccountId: string;
    amount: Prisma.Decimal;
  },
) {
  const existing = await tx.ledgerTransaction.findUnique({
    where: { idempotencyKey: params.idempotencyKey },
  });
  if (existing) return { duplicate: true as const };

  const neg = params.amount.mul(-1);
  const transaction = await tx.ledgerTransaction.create({
    data: {
      idempotencyKey: params.idempotencyKey,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      description: params.description,
      metadata: params.metadata,
    },
  });
  for (const [accountId, delta] of [
    [params.fromAccountId, neg],
    [params.toAccountId, params.amount],
  ] as const) {
    const account = await tx.ledgerAccount.findUniqueOrThrow({
      where: { id: accountId },
    });
    const nextBalance = new Prisma.Decimal(account.balance.toString()).add(delta);
    await tx.ledgerAccount.update({
      where: { id: account.id },
      data: { balance: nextBalance },
    });
    await tx.ledgerLine.create({
      data: {
        transactionId: transaction.id,
        accountId: account.id,
        delta,
        balanceAfter: nextBalance,
      },
    });
  }
  return { duplicate: false as const };
}

export function planLegacyWalletRepair(row: StaleWalletRow): RepairAction[] {
  const actions: RepairAction[] = [];
  const balance = new Prisma.Decimal(row.balance);
  const locked = new Prisma.Decimal(row.lockedBalance);

  if (locked.abs().gt(THRESHOLD)) {
    actions.push({
      kind: "migrate_locked",
      userId: row.userId,
      amount: locked.toFixed(2),
      reason: "Migrate lockedBalance to MEMBER_DEPOSIT_ESCROW if ledger gap exists",
    });
  }

  if (balance.abs().gt(THRESHOLD)) {
    actions.push({
      kind: "migrate_balance",
      userId: row.userId,
      amount: balance.toFixed(2),
      reason: "Migrate balance to MEMBER_WALLET_AVAILABLE if ledger gap exists",
    });
  }

  if (actions.length === 0) {
    actions.push({ kind: "skip", userId: row.userId, reason: "Already zero" });
  }
  return actions;
}

export async function fetchStaleWallets(
  prisma: PrismaClient,
): Promise<StaleWalletRow[]> {
  return prisma.$queryRaw<StaleWalletRow[]>`
    SELECT "userId", balance::text, "lockedBalance"::text AS "lockedBalance"
    FROM "Wallet"
    WHERE ABS(balance) > 0.01 OR ABS("lockedBalance") > 0.01
    ORDER BY "updatedAt" DESC
    LIMIT 100
  `;
}

export async function repairWalletRow(
  prisma: PrismaClient,
  row: StaleWalletRow,
  execute: boolean,
): Promise<RepairAction[]> {
  const balance = new Prisma.Decimal(row.balance);
  const locked = new Prisma.Decimal(row.lockedBalance);
  const applied: RepairAction[] = [];

  if (locked.abs().lte(THRESHOLD) && balance.abs().lte(THRESHOLD)) {
    return [{ kind: "skip", userId: row.userId, reason: "Already zero" }];
  }

  if (!execute) {
    return planLegacyWalletRepair(row);
  }

  await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId: row.userId } });
    if (!wallet) return;

    const lockedNow = new Prisma.Decimal(wallet.lockedBalance.toString());
    if (lockedNow.gt(THRESHOLD)) {
      const escrow = await getOrCreateLedgerAccount(
        tx,
        `MEMBER_DEPOSIT_ESCROW:${row.userId}:GHS`,
        LedgerAccountType.MEMBER_DEPOSIT_ESCROW,
        row.userId,
      );
      const escrowBal = new Prisma.Decimal(escrow.balance.toString());
      const gap = lockedNow.sub(escrowBal);
      if (gap.gt(THRESHOLD)) {
        const external = await getOrCreateLedgerAccount(
          tx,
          "SYSTEM_EXTERNAL:GHS",
          LedgerAccountType.SYSTEM_EXTERNAL,
        );
        await postTransferInTx(tx, {
          idempotencyKey: `legacy-wallet:migrate:locked:${row.userId}`,
          referenceType: "LEGACY_WALLET_MIGRATION",
          referenceId: row.userId,
          description: "Migrate legacy Wallet.lockedBalance to MEMBER_DEPOSIT_ESCROW",
          metadata: {
            oldBalance: wallet.balance.toString(),
            oldLockedBalance: wallet.lockedBalance.toString(),
            userId: row.userId,
            reason: "staging_repair_script",
          },
          fromAccountId: external.id,
          toAccountId: escrow.id,
          amount: gap,
        });
        applied.push({
          kind: "migrate_locked",
          userId: row.userId,
          amount: gap.toFixed(2),
          reason: "Migrated lockedBalance gap to escrow",
        });
      } else {
        applied.push({
          kind: "zero_locked",
          userId: row.userId,
          reason: "Escrow already covers lockedBalance — zeroing Wallet.lockedBalance",
        });
      }
      await tx.wallet.update({
        where: { userId: row.userId },
        data: { lockedBalance: 0 },
      });
    }

    const refreshed = await tx.wallet.findUniqueOrThrow({
      where: { userId: row.userId },
    });
    const balNow = new Prisma.Decimal(refreshed.balance.toString());
    if (balNow.gt(THRESHOLD)) {
      const available = await getOrCreateLedgerAccount(
        tx,
        `MEMBER_WALLET_AVAILABLE:${row.userId}:GHS`,
        LedgerAccountType.MEMBER_WALLET_AVAILABLE,
        row.userId,
      );
      const availBal = new Prisma.Decimal(available.balance.toString());
      const gap = balNow.sub(availBal);
      if (gap.gt(THRESHOLD)) {
        const external = await getOrCreateLedgerAccount(
          tx,
          "SYSTEM_EXTERNAL:GHS",
          LedgerAccountType.SYSTEM_EXTERNAL,
        );
        await postTransferInTx(tx, {
          idempotencyKey: `legacy-wallet:migrate:balance:${row.userId}`,
          referenceType: "LEGACY_WALLET_MIGRATION",
          referenceId: row.userId,
          description: "Migrate legacy Wallet.balance to MEMBER_WALLET_AVAILABLE",
          metadata: {
            oldBalance: refreshed.balance.toString(),
            oldLockedBalance: refreshed.lockedBalance.toString(),
            userId: row.userId,
            reason: "staging_repair_script",
          },
          fromAccountId: external.id,
          toAccountId: available.id,
          amount: gap,
        });
        applied.push({
          kind: "migrate_balance",
          userId: row.userId,
          amount: gap.toFixed(2),
          reason: "Migrated balance gap to available wallet",
        });
      } else if (availBal.gt(balNow.add(THRESHOLD))) {
        throw new Error(
          `Refusing repair for ${row.userId}: ledger available exceeds Wallet.balance — manual review required`,
        );
      } else {
        applied.push({
          kind: "zero_balance",
          userId: row.userId,
          reason: "Available ledger already covers Wallet.balance — zeroing Wallet.balance",
        });
      }
      await tx.wallet.update({
        where: { userId: row.userId },
        data: { balance: 0 },
      });
    }
  });

  return applied.length > 0 ? applied : planLegacyWalletRepair(row);
}

export async function runLegacyWalletRepair(
  prisma: PrismaClient,
  execute: boolean,
): Promise<void> {
  const rows = await fetchStaleWallets(prisma);
  if (rows.length === 0) {
    console.log("[repair:legacy-wallet] no stale Wallet rows found");
    return;
  }

  console.log(`[repair:legacy-wallet] found ${rows.length} stale row(s)`);
  for (const row of rows) {
    console.log(
      `[repair:legacy-wallet] user=${row.userId} balance=${row.balance} locked=${row.lockedBalance}`,
    );
    const actions = await repairWalletRow(prisma, row, execute);
    for (const action of actions) {
      console.log(
        `  → ${action.kind}: ${action.reason}${"amount" in action ? ` (${action.amount})` : ""}`,
      );
    }
  }

  if (!execute) {
    console.log("\n[repair:legacy-wallet] dry-run complete — rerun with --execute to apply");
  } else {
    const remaining = await fetchStaleWallets(prisma);
    console.log(
      `[repair:legacy-wallet] execute complete — ${remaining.length} stale row(s) remaining`,
    );
  }
}
