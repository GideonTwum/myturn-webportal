import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { Prisma, WithdrawalActorRole } from "@prisma/client";
import {
  assertWithdrawalWithinLimits,
  getWithdrawalLimitsConfig,
} from "./withdrawal-limits";

describe("withdrawal limits", () => {
  beforeEach(() => {
    delete process.env.WITHDRAWAL_MIN_AMOUNT;
    delete process.env.WITHDRAWAL_MAX_SINGLE_AMOUNT;
    delete process.env.WITHDRAWAL_MAX_DAILY_AMOUNT;
    delete process.env.WITHDRAWAL_MAX_DAILY_COUNT;
  });

  it("uses default limits from env", () => {
    const limits = getWithdrawalLimitsConfig();
    expect(limits.minAmount.toString()).toBe("1");
    expect(limits.maxSingleAmount.toString()).toBe("5000");
    expect(limits.maxDailyCount).toBe(5);
  });

  it("rejects amount below minimum without moving funds", async () => {
    const prisma = {
      withdrawalRequest: { findMany: vi.fn() },
    };
    await expect(
      assertWithdrawalWithinLimits(
        prisma as never,
        "user-1",
        WithdrawalActorRole.MEMBER,
        new Prisma.Decimal("0.50"),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.withdrawalRequest.findMany).not.toHaveBeenCalled();
  });

  it("rejects when daily count exceeded", async () => {
    const prisma = {
      withdrawalRequest: {
        findMany: vi.fn().mockResolvedValue([
          { amount: new Prisma.Decimal("10") },
          { amount: new Prisma.Decimal("10") },
          { amount: new Prisma.Decimal("10") },
          { amount: new Prisma.Decimal("10") },
          { amount: new Prisma.Decimal("10") },
        ]),
      },
    };
    await expect(
      assertWithdrawalWithinLimits(
        prisma as never,
        "user-1",
        WithdrawalActorRole.MEMBER,
        new Prisma.Decimal("10"),
      ),
    ).rejects.toThrow(/Daily withdrawal limit reached/);
  });
});
