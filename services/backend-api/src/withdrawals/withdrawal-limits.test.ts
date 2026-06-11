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

  it("defaults to no max single/daily caps when env unset", () => {
    const limits = getWithdrawalLimitsConfig();
    expect(limits.minAmount.toString()).toBe("1");
    expect(limits.maxSingleAmount).toBeNull();
    expect(limits.maxDailyAmount).toBeNull();
    expect(limits.maxDailyCount).toBeNull();
  });

  it("allows withdrawal of full available balance when no max single limit", async () => {
    const prisma = {
      withdrawalRequest: { findMany: vi.fn() },
    };
    await expect(
      assertWithdrawalWithinLimits(
        prisma as never,
        "user-1",
        WithdrawalActorRole.MEMBER,
        new Prisma.Decimal("42000"),
      ),
    ).resolves.toBeUndefined();
    expect(prisma.withdrawalRequest.findMany).not.toHaveBeenCalled();
  });

  it("enforces explicit max single limit when configured", async () => {
    process.env.WITHDRAWAL_MAX_SINGLE_AMOUNT = "5000";
    const prisma = {
      withdrawalRequest: { findMany: vi.fn() },
    };
    await expect(
      assertWithdrawalWithinLimits(
        prisma as never,
        "user-1",
        WithdrawalActorRole.MEMBER,
        new Prisma.Decimal("5000.01"),
      ),
    ).rejects.toThrow(/Maximum single withdrawal is GHS 5000.00/);
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

  it("rejects when daily count exceeded and limit configured", async () => {
    process.env.WITHDRAWAL_MAX_DAILY_COUNT = "5";
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

  it("rejects when daily amount exceeded and limit configured", async () => {
    process.env.WITHDRAWAL_MAX_DAILY_AMOUNT = "10000";
    const prisma = {
      withdrawalRequest: {
        findMany: vi.fn().mockResolvedValue([
          { amount: new Prisma.Decimal("9000") },
        ]),
      },
    };
    await expect(
      assertWithdrawalWithinLimits(
        prisma as never,
        "user-1",
        WithdrawalActorRole.MEMBER,
        new Prisma.Decimal("2000"),
      ),
    ).rejects.toThrow(/Daily withdrawal limit is GHS 10000.00/);
  });
});
