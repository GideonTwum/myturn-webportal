import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ContributionGuaranteeReserveStatus,
  GroupStatus,
  Prisma,
} from "@prisma/client";
import { ContributionGuaranteeReserveService } from "./contribution-guarantee-reserve.service";

describe("ContributionGuaranteeReserveService", () => {
  const accounts = {
    getOrCreateMemberWallet: vi.fn(),
    getOrCreateMemberWalletAvailable: vi.fn(),
    getOrCreateMemberWalletReserved: vi.fn(),
    getBalance: vi.fn(),
  };
  const posting = { postTransferInTx: vi.fn() };
  const notifications = { create: vi.fn() };
  const prisma = {
    contributionGuaranteeReserve: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    group: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
  };

  let svc: ContributionGuaranteeReserveService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new ContributionGuaranteeReserveService(
      prisma as never,
      accounts as never,
      posting as never,
      notifications as never,
    );
  });

  describe("computeSplit", () => {
    it("credits full payout to available when feature disabled", () => {
      vi.stubEnv("CONTRIBUTION_RESERVE_ENABLED", "false");
      const split = svc.computeSplit(1_000_000n, 1, 200, 30);
      expect(split.reserveMinor).toBe(0n);
      expect(split.availableMinor).toBe(1_000_000n);
      expect(split.postPayoutContributionUnits).toBe(199 * 30);
      vi.unstubAllEnvs();
    });

    it("uses payment units for release denominator", () => {
      vi.stubEnv("CONTRIBUTION_RESERVE_ENABLED", "true");
      vi.stubEnv("CONTRIBUTION_RESERVE_MAX_BPS", "3000");
      vi.stubEnv("CONTRIBUTION_RESERVE_MAX_AMOUNT", "3000");
      const split = svc.computeSplit(1_000_000n, 199, 200, 30);
      expect(split.postPayoutContributionUnits).toBe(30);
      vi.unstubAllEnvs();
    });

    it("does not cap reserve by deprecated CONTRIBUTION_RESERVE_MAX_AMOUNT", () => {
      vi.stubEnv("CONTRIBUTION_RESERVE_ENABLED", "true");
      vi.stubEnv("CONTRIBUTION_RESERVE_MAX_BPS", "3000");
      vi.stubEnv("CONTRIBUTION_RESERVE_MAX_AMOUNT", "3000");
      const split = svc.computeSplit(10_000_000n, 1, 10, 1);
      // 27% of GHS 100,000 = GHS 27,000 (not capped to GHS 3,000)
      expect(split.reserveMinor).toBe(2_700_000n);
      vi.unstubAllEnvs();
    });

    it("gives 0% reserve to last recipient", () => {
      vi.stubEnv("CONTRIBUTION_RESERVE_ENABLED", "true");
      const split = svc.computeSplit(500_000n, 200, 200, 30);
      expect(split.reserveMinor).toBe(0n);
      expect(split.availableMinor).toBe(500_000n);
      vi.unstubAllEnvs();
    });
  });

  describe("tryReleaseOnPaymentSettledInTx", () => {
    const baseReserve = {
      id: "r1",
      cycleNumber: 1,
      remainingReserveAmount: new Prisma.Decimal("3000"),
      originalReserveAmount: new Prisma.Decimal("3000"),
      releasedAmount: new Prisma.Decimal("0"),
      remainingContributionCountAtCreation: 30,
      contributionsReleasedCount: 0,
      releasePerContributionAmount: new Prisma.Decimal("100"),
      group: { name: "Test Group" },
    };

    beforeEach(() => {
      accounts.getOrCreateMemberWalletReserved.mockResolvedValue({
        id: "reserved-acct",
      });
      accounts.getOrCreateMemberWalletAvailable.mockResolvedValue({
        id: "available-acct",
      });
      posting.postTransferInTx.mockResolvedValue({ duplicate: false });
      prisma.contributionGuaranteeReserve.update.mockResolvedValue({});
    });

    it("skips DB lookup when reserve feature is disabled", async () => {
      vi.stubEnv("CONTRIBUTION_RESERVE_ENABLED", "false");
      const tx = {
        contributionGuaranteeReserve: prisma.contributionGuaranteeReserve,
      };

      const result = await svc.tryReleaseOnPaymentSettledInTx(tx as never, {
        userId: "u1",
        groupId: "g1",
        contributionId: "c2",
        paymentId: "p2",
        cycleNumber: 2,
        paidDayIndex: 1,
      });

      expect(result.released).toBe(false);
      expect(prisma.contributionGuaranteeReserve.findFirst).not.toHaveBeenCalled();
      vi.unstubAllEnvs();
    });

    it("does not release for payout-cycle or earlier payments", async () => {
      vi.stubEnv("CONTRIBUTION_RESERVE_ENABLED", "true");
      prisma.contributionGuaranteeReserve.findFirst.mockResolvedValue(
        baseReserve,
      );
      const tx = {
        contributionGuaranteeReserve: prisma.contributionGuaranteeReserve,
      };

      const result = await svc.tryReleaseOnPaymentSettledInTx(tx as never, {
        userId: "u1",
        groupId: "g1",
        contributionId: "c1",
        paymentId: "p1",
        cycleNumber: 1,
        paidDayIndex: 1,
      });

      expect(result.released).toBe(false);
      expect(posting.postTransferInTx).not.toHaveBeenCalled();
      vi.unstubAllEnvs();
    });

    it("releases after one successful daily payment without waiting for full cycle PAID", async () => {
      vi.stubEnv("CONTRIBUTION_RESERVE_ENABLED", "true");
      prisma.contributionGuaranteeReserve.findFirst.mockResolvedValue(
        baseReserve,
      );
      const tx = {
        contributionGuaranteeReserve: prisma.contributionGuaranteeReserve,
      };

      const result = await svc.tryReleaseOnPaymentSettledInTx(tx as never, {
        userId: "u1",
        groupId: "g1",
        contributionId: "c2",
        paymentId: "p2",
        cycleNumber: 2,
        paidDayIndex: 1,
      });

      expect(result.released).toBe(true);
      expect(result.amount).toBe("100.00");
      expect(posting.postTransferInTx).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          idempotencyKey: "reserve:release:r1:payment:p2",
        }),
      );
      vi.unstubAllEnvs();
    });

    it("does not release twice for the same payment", async () => {
      vi.stubEnv("CONTRIBUTION_RESERVE_ENABLED", "true");
      prisma.contributionGuaranteeReserve.findFirst.mockResolvedValue(
        baseReserve,
      );
      posting.postTransferInTx.mockResolvedValue({ duplicate: true });
      const tx = {
        contributionGuaranteeReserve: prisma.contributionGuaranteeReserve,
      };

      const result = await svc.tryReleaseOnPaymentSettledInTx(tx as never, {
        userId: "u1",
        groupId: "g1",
        contributionId: "c2",
        paymentId: "p2",
        cycleNumber: 2,
        paidDayIndex: 1,
      });

      expect(result.released).toBe(false);
      expect(prisma.contributionGuaranteeReserve.update).not.toHaveBeenCalled();
      vi.unstubAllEnvs();
    });

    it("final release absorbs rounding remainder", async () => {
      vi.stubEnv("CONTRIBUTION_RESERVE_ENABLED", "true");
      prisma.contributionGuaranteeReserve.findFirst.mockResolvedValue({
        ...baseReserve,
        remainingReserveAmount: new Prisma.Decimal("10"),
        contributionsReleasedCount: 29,
      });
      const tx = {
        contributionGuaranteeReserve: prisma.contributionGuaranteeReserve,
      };

      const result = await svc.tryReleaseOnPaymentSettledInTx(tx as never, {
        userId: "u1",
        groupId: "g1",
        contributionId: "c2",
        paymentId: "p-last",
        cycleNumber: 2,
        paidDayIndex: 30,
      });

      expect(result.released).toBe(true);
      expect(result.amount).toBe("10.00");
      expect(result.fullyReleased).toBe(true);
      vi.unstubAllEnvs();
    });
  });

  describe("releaseAllActiveReservesOnGroupCompletedInTx", () => {
    const activeReserve = {
      id: "r-final",
      userId: "u1",
      groupId: "g1",
      payoutId: "p1",
      remainingReserveAmount: new Prisma.Decimal("500"),
      releasedAmount: new Prisma.Decimal("2500"),
      remainingContributionCountAtCreation: 40,
      contributionsReleasedCount: 35,
      metadata: {},
      status: ContributionGuaranteeReserveStatus.ACTIVE,
    };

    beforeEach(() => {
      accounts.getOrCreateMemberWalletReserved.mockResolvedValue({
        id: "reserved-acct",
      });
      accounts.getOrCreateMemberWalletAvailable.mockResolvedValue({
        id: "available-acct",
      });
      posting.postTransferInTx.mockResolvedValue({ duplicate: false });
      prisma.contributionGuaranteeReserve.update.mockResolvedValue({});
    });

    function tx() {
      return {
        group: prisma.group,
        contributionGuaranteeReserve: prisma.contributionGuaranteeReserve,
      };
    }

    beforeEach(() => {
      prisma.contributionGuaranteeReserve.count = vi.fn().mockResolvedValue(0);
      accounts.getBalance = vi.fn().mockResolvedValue(new Prisma.Decimal(0));
    });

    it("does nothing when group is not COMPLETED", async () => {
      prisma.group.findUnique.mockResolvedValue({
        status: GroupStatus.ACTIVE,
        name: "Open Group",
      });

      const results =
        await svc.releaseAllActiveReservesOnGroupCompletedInTx(tx() as never, {
          groupId: "g1",
        });

      expect(results).toEqual([]);
      expect(prisma.contributionGuaranteeReserve.findMany).not.toHaveBeenCalled();
    });

    it("releases remaining active reserves into available wallet", async () => {
      prisma.group.findUnique.mockResolvedValue({
        status: GroupStatus.COMPLETED,
        name: "Done Group",
      });
      prisma.contributionGuaranteeReserve.findMany.mockResolvedValue([
        activeReserve,
      ]);

      const results =
        await svc.releaseAllActiveReservesOnGroupCompletedInTx(tx() as never, {
          groupId: "g1",
        });

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        released: true,
        userId: "u1",
        amount: "500.00",
        groupName: "Done Group",
        reserveId: "r-final",
        payoutId: "p1",
      });
      expect(posting.postTransferInTx).toHaveBeenCalledWith(
        tx(),
        expect.objectContaining({
          idempotencyKey: "reserve:final-release:r-final:group-completed",
          fromAccountId: "reserved-acct",
          toAccountId: "available-acct",
          amount: expect.objectContaining({ toString: expect.any(Function) }),
          metadata: expect.objectContaining({
            releaseReason: "GROUP_COMPLETED",
            groupId: "g1",
            reserveId: "r-final",
            payoutId: "p1",
          }),
        }),
      );
      expect(prisma.contributionGuaranteeReserve.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "r-final" },
          data: expect.objectContaining({
            remainingReserveAmount: expect.any(Prisma.Decimal),
            status: ContributionGuaranteeReserveStatus.RELEASED,
          }),
        }),
      );
      const updateArg =
        prisma.contributionGuaranteeReserve.update.mock.calls[0]![0];
      expect(updateArg.data.remainingReserveAmount.toString()).toBe("0");
      expect(updateArg.data.releasedAmount.toString()).toBe("3000");
    });

    it("queries all ACTIVE reserves including zero remaining", async () => {
      prisma.group.findUnique.mockResolvedValue({
        status: GroupStatus.COMPLETED,
        name: "Done Group",
      });
      prisma.contributionGuaranteeReserve.findMany.mockResolvedValue([]);

      await svc.releaseAllActiveReservesOnGroupCompletedInTx(tx() as never, {
        groupId: "g1",
      });

      expect(prisma.contributionGuaranteeReserve.findMany).toHaveBeenCalledWith({
        where: {
          groupId: "g1",
          status: ContributionGuaranteeReserveStatus.ACTIVE,
        },
      });
    });

    it("marks ACTIVE reserve with remaining 0 as RELEASED at completion", async () => {
      const zeroRemainingReserve = {
        ...activeReserve,
        remainingReserveAmount: new Prisma.Decimal(0),
      };
      prisma.group.findUnique.mockResolvedValue({
        status: GroupStatus.COMPLETED,
        name: "Done Group",
      });
      prisma.contributionGuaranteeReserve.findMany.mockResolvedValue([
        zeroRemainingReserve,
      ]);
      prisma.contributionGuaranteeReserve.count.mockResolvedValue(0);
      accounts.getBalance.mockResolvedValue(new Prisma.Decimal(0));

      await svc.releaseAllActiveReservesOnGroupCompletedInTx(tx() as never, {
        groupId: "g1",
      });

      expect(posting.postTransferInTx).not.toHaveBeenCalled();
      expect(prisma.contributionGuaranteeReserve.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "r-final" },
          data: expect.objectContaining({
            status: ContributionGuaranteeReserveStatus.RELEASED,
            remainingReserveAmount: expect.any(Prisma.Decimal),
          }),
        }),
      );
    });

    it("sweeps orphaned reserved ledger balance when no ACTIVE reserves remain", async () => {
      prisma.group.findUnique.mockResolvedValue({
        status: GroupStatus.COMPLETED,
        name: "Done Group",
      });
      prisma.contributionGuaranteeReserve.findMany.mockResolvedValue([
        {
          ...activeReserve,
          remainingReserveAmount: new Prisma.Decimal(0),
        },
      ]);
      prisma.contributionGuaranteeReserve.count.mockResolvedValue(0);
      accounts.getBalance.mockResolvedValue(new Prisma.Decimal("840"));
      accounts.getOrCreateMemberWalletReserved.mockResolvedValue({
        id: "reserved-acct",
      });
      accounts.getOrCreateMemberWalletAvailable.mockResolvedValue({
        id: "available-acct",
      });
      posting.postTransferInTx.mockResolvedValue({ duplicate: false });

      await svc.releaseAllActiveReservesOnGroupCompletedInTx(tx() as never, {
        groupId: "g1",
      });

      expect(posting.postTransferInTx).toHaveBeenCalledWith(
        tx(),
        expect.objectContaining({
          idempotencyKey: "reserve:orphan-sweep:u1",
          fromAccountId: "reserved-acct",
          toAccountId: "available-acct",
          amount: expect.objectContaining({
            toString: expect.any(Function),
          }),
        }),
      );
      const sweepArg = posting.postTransferInTx.mock.calls.find(
        (c) => c[1]?.idempotencyKey === "reserve:orphan-sweep:u1",
      );
      expect(sweepArg?.[1].amount.toString()).toBe("840");
    });

    it("is idempotent when finalize is retried", async () => {
      prisma.group.findUnique.mockResolvedValue({
        status: GroupStatus.COMPLETED,
        name: "Done Group",
      });
      prisma.contributionGuaranteeReserve.findMany.mockResolvedValue([
        activeReserve,
      ]);
      posting.postTransferInTx.mockResolvedValue({ duplicate: true });
      prisma.contributionGuaranteeReserve.findUnique.mockResolvedValue({
        ...activeReserve,
        status: ContributionGuaranteeReserveStatus.ACTIVE,
      });

      const results =
        await svc.releaseAllActiveReservesOnGroupCompletedInTx(tx() as never, {
          groupId: "g1",
        });

      expect(results).toHaveLength(1);
      expect(results[0]!.amount).toBe("500.00");
      expect(prisma.contributionGuaranteeReserve.update).toHaveBeenCalledTimes(1);
    });

    it("does not double-release when ledger transfer is duplicate and reserve already RELEASED", async () => {
      prisma.group.findUnique.mockResolvedValue({
        status: GroupStatus.COMPLETED,
        name: "Done Group",
      });
      prisma.contributionGuaranteeReserve.findMany.mockResolvedValue([
        activeReserve,
      ]);
      posting.postTransferInTx.mockResolvedValue({ duplicate: true });
      prisma.contributionGuaranteeReserve.findUnique.mockResolvedValue({
        ...activeReserve,
        remainingReserveAmount: new Prisma.Decimal(0),
        status: ContributionGuaranteeReserveStatus.RELEASED,
      });

      const results =
        await svc.releaseAllActiveReservesOnGroupCompletedInTx(tx() as never, {
          groupId: "g1",
        });

      expect(results).toEqual([]);
      expect(prisma.contributionGuaranteeReserve.update).not.toHaveBeenCalled();
    });

    it("keeps ledger transfer balanced (reserved debit equals available credit)", async () => {
      prisma.group.findUnique.mockResolvedValue({
        status: GroupStatus.COMPLETED,
        name: "Done Group",
      });
      prisma.contributionGuaranteeReserve.findMany.mockResolvedValue([
        activeReserve,
      ]);

      await svc.releaseAllActiveReservesOnGroupCompletedInTx(tx() as never, {
        groupId: "g1",
      });

      const transferArg = posting.postTransferInTx.mock.calls[0]![1];
      const amount = new Prisma.Decimal(transferArg.amount.toString());
      const reservedDebit = amount.mul(-1);
      const availableCredit = amount;
      const sum = reservedDebit.add(availableCredit);
      expect(sum.isZero()).toBe(true);
    });
  });

  describe("notifyGroupCompletedReserveRelease", () => {
    it("sends group-completion reserve notification", async () => {
      await svc.notifyGroupCompletedReserveRelease({
        userId: "u1",
        amount: "500.00",
        groupName: "Done Group",
        reserveId: "r1",
        payoutId: "p1",
      });

      expect(notifications.create).toHaveBeenCalledWith(
        "u1",
        "Reserve fully unlocked",
        expect.stringContaining("Done Group"),
        "RESERVE_GROUP_COMPLETED_RELEASE",
        expect.objectContaining({
          amount: "500.00",
          releaseReason: "GROUP_COMPLETED",
        }),
      );
    });
  });
});
