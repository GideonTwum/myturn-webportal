import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import {
  ContributionGuaranteeReserveStatus,
  ContributionStatus,
  MemberCycleStanding,
  PayoutStatus,
  Prisma,
} from "@prisma/client";
import {
  RESERVE_FULL_COVER_TITLE,
  RESERVE_PARTIAL_COVER_TITLE,
  reserveFullCoverNotificationBody,
  reservePartialCoverNotificationBody,
} from "./default-protection.messages";
import { DefaultProtectionService } from "./default-protection.service";

describe("DefaultProtectionService", () => {
  let prisma: {
    groupMember: {
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
    };
    contribution: { findFirst: ReturnType<typeof vi.fn> };
    payout: { findFirst: ReturnType<typeof vi.fn> };
    defaultCoverage: {
      aggregate: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    group: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> };
  };
  let reserve: { coverDefaultFromReserveInTx: ReturnType<typeof vi.fn> };
  let notifications: { create: ReturnType<typeof vi.fn> };
  let svc: DefaultProtectionService;

  beforeEach(() => {
    prisma = {
      groupMember: {
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
        findUnique: vi.fn(),
      },
      contribution: { findFirst: vi.fn() },
      payout: { findFirst: vi.fn() },
      defaultCoverage: {
        aggregate: vi.fn().mockResolvedValue({
          _sum: { coveredAmount: 0 },
          _count: { id: 0 },
        }),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      group: {
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    reserve = { coverDefaultFromReserveInTx: vi.fn().mockResolvedValue({ covered: false }) };
    notifications = { create: vi.fn() };
    svc = new DefaultProtectionService(
      prisma as never,
      reserve as never,
      notifications as never,
    );
  });

  it("blocks withdrawal when member has unresolved DEFAULTED participation", async () => {
    prisma.groupMember.findMany.mockResolvedValue([
      {
        groupId: "g1",
        group: { name: "Big men", currentCycle: 3 },
      },
    ]);
    prisma.contribution.findFirst.mockResolvedValue({
      id: "c1",
      status: ContributionStatus.PENDING,
    });

    await expect(svc.assertWithdrawalNotRestricted("u1")).rejects.toThrow(
      BadRequestException,
    );
    await expect(svc.assertWithdrawalNotRestricted("u1")).rejects.toThrow(
      /unresolved contribution in Big men/,
    );
  });

  it("allows withdrawal when defaulted but contribution fully covered", async () => {
    prisma.groupMember.findMany.mockResolvedValue([
      {
        groupId: "g1",
        group: { name: "Big men", currentCycle: 3 },
      },
    ]);
    prisma.contribution.findFirst.mockResolvedValue({
      id: "c1",
      status: ContributionStatus.PAID,
    });

    await expect(svc.assertWithdrawalNotRestricted("u1")).resolves.toBeUndefined();
  });

  it("blocks withdrawal after partial reserve cover leaves contribution unpaid", async () => {
    prisma.groupMember.findMany.mockResolvedValue([
      {
        groupId: "g1",
        group: { name: "Savings Club", currentCycle: 2 },
      },
    ]);
    prisma.contribution.findFirst.mockResolvedValue({
      id: "c1",
      status: ContributionStatus.PENDING,
    });

    await expect(svc.assertWithdrawalNotRestricted("u1")).rejects.toThrow(
      /unresolved contribution in Savings Club/i,
    );
  });

  it("blocks joining new group when unresolved default exists", async () => {
    prisma.groupMember.findMany.mockResolvedValue([
      {
        groupId: "g1",
        group: { name: "Savings Club", currentCycle: 2 },
      },
    ]);
    prisma.contribution.findFirst.mockResolvedValue({
      id: "c1",
      status: ContributionStatus.PENDING,
    });

    await expect(svc.assertCanJoinNewGroup("u1")).rejects.toThrow(
      /cannot join a new group while you have an unresolved contribution in Savings Club/i,
    );
  });

  it("onMemberNewlyDefaulted sends active-again notification on full reserve cover", async () => {
    const tx = {
      payout: { findFirst: vi.fn().mockResolvedValue({ id: "p1" }) },
      groupMember: {
        update: vi.fn(),
        findMany: vi.fn(),
      },
    };
    reserve.coverDefaultFromReserveInTx.mockResolvedValue({
      covered: true,
      amount: "450.00",
      reserveId: "r1",
      fullyCovered: true,
    });

    await svc.onMemberNewlyDefaulted(tx as never, {
      memberId: "m1",
      userId: "u1",
      groupId: "g1",
      groupName: "Group A",
      cycleNumber: 5,
      contributionId: "c1",
    });

    expect(notifications.create).toHaveBeenCalledWith(
      "u1",
      RESERVE_FULL_COVER_TITLE,
      reserveFullCoverNotificationBody("Group A"),
      "RESERVE_USED_FOR_DEFAULT",
      expect.objectContaining({
        groupId: "g1",
        contributionId: "c1",
        fullyCovered: true,
      }),
    );
  });

  it("onMemberNewlyDefaulted sends remaining-balance notification on partial cover", async () => {
    const tx = {
      payout: { findFirst: vi.fn().mockResolvedValue({ id: "p1" }) },
      groupMember: {
        update: vi.fn(),
        findMany: vi.fn(),
      },
    };
    reserve.coverDefaultFromReserveInTx.mockResolvedValue({
      covered: true,
      amount: "200.00",
      reserveId: "r1",
      fullyCovered: false,
      partial: true,
    });

    await svc.onMemberNewlyDefaulted(tx as never, {
      memberId: "m1",
      userId: "u1",
      groupId: "g1",
      groupName: "Group A",
      cycleNumber: 5,
      contributionId: "c1",
    });

    expect(notifications.create).toHaveBeenCalledWith(
      "u1",
      RESERVE_PARTIAL_COVER_TITLE,
      reservePartialCoverNotificationBody("Group A"),
      "RESERVE_PARTIAL_DEFAULT_COVER",
      expect.objectContaining({
        groupId: "g1",
        contributionId: "c1",
        fullyCovered: false,
      }),
    );
  });

  it("onContributionFullySettled restores ACTIVE for defaulted member", async () => {
    const tx = {
      groupMember: {
        findUnique: vi.fn().mockResolvedValue({
          id: "m1",
          cycleStanding: MemberCycleStanding.DEFAULTED,
        }),
        update: vi.fn(),
      },
    };

    await svc.onContributionFullySettled(tx as never, {
      memberId: "m1",
      userId: "u1",
      groupId: "g1",
      groupName: "Group A",
    });

    expect(tx.groupMember.update).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: {
        cycleStanding: MemberCycleStanding.ACTIVE,
        resolvedAt: expect.any(Date),
      },
    });
  });

  it("onMemberNewlyDefaulted dequeues member without prior payout", async () => {
    const tx = {
      payout: { findFirst: vi.fn().mockResolvedValue(null) },
      groupMember: {
        update: vi.fn(),
        findMany: vi.fn().mockResolvedValue([
          { effectivePayoutOrder: 1 },
          { effectivePayoutOrder: 5 },
        ]),
      },
    };

    await svc.onMemberNewlyDefaulted(tx as never, {
      memberId: "m2",
      userId: "u2",
      groupId: "g1",
      groupName: "Group B",
      cycleNumber: 2,
      contributionId: "c2",
    });

    expect(tx.groupMember.update).toHaveBeenCalledWith({
      where: { id: "m2" },
      data: {
        defaultedAt: expect.any(Date),
        effectivePayoutOrder: 6,
      },
    });
    expect(notifications.create).toHaveBeenCalledWith(
      "u2",
      "Payout turn skipped",
      expect.stringContaining("Group B"),
      "PAYOUT_TURN_SKIPPED_DEFAULT",
      expect.any(Object),
    );
  });
});
