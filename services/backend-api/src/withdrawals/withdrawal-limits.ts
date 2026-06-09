import { BadRequestException } from "@nestjs/common";
import { Prisma, WithdrawalActorRole, WithdrawalStatus } from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";

export type WithdrawalLimitsConfig = {
  minAmount: Prisma.Decimal;
  maxSingleAmount: Prisma.Decimal;
  maxDailyAmount: Prisma.Decimal;
  maxDailyCount: number;
};

function parseDecimal(name: string, fallback: string): Prisma.Decimal {
  const raw = process.env[name]?.trim() ?? fallback;
  const d = new Prisma.Decimal(raw);
  if (d.lt(0)) return new Prisma.Decimal(fallback);
  return d;
}

function parseIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getWithdrawalLimitsConfig(): WithdrawalLimitsConfig {
  return {
    minAmount: parseDecimal("WITHDRAWAL_MIN_AMOUNT", "1"),
    maxSingleAmount: parseDecimal("WITHDRAWAL_MAX_SINGLE_AMOUNT", "5000"),
    maxDailyAmount: parseDecimal("WITHDRAWAL_MAX_DAILY_AMOUNT", "10000"),
    maxDailyCount: parseIntEnv("WITHDRAWAL_MAX_DAILY_COUNT", 5),
  };
}

export function getStaleWithdrawalThresholdMs(): number {
  const raw = process.env.STALE_WITHDRAWAL_THRESHOLD_MS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 60_000) return n;
  }
  return 30 * 60 * 1000;
}

export async function assertWithdrawalWithinLimits(
  prisma: PrismaService,
  actorId: string,
  actorRole: WithdrawalActorRole,
  amount: Prisma.Decimal,
): Promise<void> {
  const limits = getWithdrawalLimitsConfig();

  if (amount.lt(limits.minAmount)) {
    throw new BadRequestException(
      `Minimum withdrawal is GHS ${limits.minAmount.toFixed(2)}`,
    );
  }
  if (amount.gt(limits.maxSingleAmount)) {
    throw new BadRequestException(
      `Maximum single withdrawal is GHS ${limits.maxSingleAmount.toFixed(2)}`,
    );
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const today = await prisma.withdrawalRequest.findMany({
    where: {
      actorId,
      actorRole,
      requestedAt: { gte: startOfDay },
      status: {
        in: [
          WithdrawalStatus.PENDING,
          WithdrawalStatus.PROCESSING,
          WithdrawalStatus.COMPLETED,
        ],
      },
    },
    select: { amount: true },
  });

  if (today.length >= limits.maxDailyCount) {
    throw new BadRequestException(
      `Daily withdrawal limit reached (${limits.maxDailyCount} per day)`,
    );
  }

  const dailyTotal = today.reduce(
    (sum, row) => sum.add(row.amount),
    new Prisma.Decimal(0),
  );
  if (dailyTotal.add(amount).gt(limits.maxDailyAmount)) {
    throw new BadRequestException(
      `Daily withdrawal limit is GHS ${limits.maxDailyAmount.toFixed(2)}`,
    );
  }
}
