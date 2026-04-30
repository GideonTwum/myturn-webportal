import { Injectable } from "@nestjs/common";
import { LedgerEntryType, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class WalletsService {
  constructor(private prisma: PrismaService) {}

  getOrCreate(userId: string) {
    return this.prisma.wallet.upsert({
      where: { userId },
      create: { userId, balance: 0, currency: "GHS" },
      update: {},
    });
  }

  /**
   * CREDIT increases balance, DEBIT decreases — matches ledger semantics used for contributions/payouts.
   * Call inside the same DB transaction as the ledger row.
   */
  async applyLedgerDelta(
    tx: Prisma.TransactionClient,
    userId: string,
    type: LedgerEntryType,
    amount: Prisma.Decimal,
  ): Promise<void> {
    const delta =
      type === LedgerEntryType.CREDIT
        ? new Prisma.Decimal(amount.toString())
        : new Prisma.Decimal(amount.toString()).mul(-1);
    const existing = await tx.wallet.findUnique({ where: { userId } });
    const prev = existing?.balance ?? new Prisma.Decimal(0);
    const next = prev.add(delta);
    await tx.wallet.upsert({
      where: { userId },
      create: { userId, balance: next, currency: "GHS" },
      update: { balance: next },
    });
  }

  /** Add to escrow (locked) — does not change spendable balance. Call inside same transaction as ledger. */
  async addLockedEscrow(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: Prisma.Decimal,
  ): Promise<void> {
    const existing = await tx.wallet.findUnique({ where: { userId } });
    const prev =
      existing?.lockedBalance != null
        ? new Prisma.Decimal(existing.lockedBalance.toString())
        : new Prisma.Decimal(0);
    const next = prev.add(amount);
    await tx.wallet.upsert({
      where: { userId },
      create: {
        userId,
        balance: 0,
        lockedBalance: amount,
        currency: "GHS",
      },
      update: { lockedBalance: next },
    });
  }

  /** Remove from escrow (forfeit) — locked funds leave the member's wallet. */
  async reduceLockedEscrow(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: Prisma.Decimal,
  ): Promise<void> {
    const existing = await tx.wallet.findUnique({ where: { userId } });
    if (!existing) return;
    const prev = new Prisma.Decimal(existing.lockedBalance.toString());
    const next = Prisma.Decimal.max(prev.sub(amount), new Prisma.Decimal(0));
    await tx.wallet.update({
      where: { userId },
      data: { lockedBalance: next },
    });
  }

  /** Move amount from locked to spendable (e.g. group completed cleanly). */
  async releaseLockedToBalance(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: Prisma.Decimal,
  ): Promise<void> {
    const existing = await tx.wallet.findUnique({ where: { userId } });
    if (!existing) return;
    const locked = new Prisma.Decimal(existing.lockedBalance.toString());
    const bal = new Prisma.Decimal(existing.balance.toString());
    const rel = Prisma.Decimal.min(locked, amount);
    const nextLocked = locked.sub(rel);
    const nextBal = bal.add(rel);
    await tx.wallet.update({
      where: { userId },
      data: { lockedBalance: nextLocked, balance: nextBal },
    });
  }
}
