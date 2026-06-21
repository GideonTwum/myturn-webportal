import { beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import {
  ContributionStatus,
  MemberCycleStanding,
  PayoutMode,
  UserRole,
} from "@prisma/client";
import { selectPayoutRecipient } from "@myturn/shared";
import { PayoutsService } from "./payouts.service";
import { assertCycleContributionsReadyForFinalize } from "./payout-contribution-readiness";

describe("PayoutsService finalize readiness", () => {
  it("selectPayoutRecipient skips defaulted nominal recipient and picks next eligible", () => {
    const members = [
      {
        userId: "u1",
        turnOrder: 1,
        effectivePayoutOrder: 1,
        cycleStanding: "DEFAULTED" as const,
      },
      {
        userId: "u2",
        turnOrder: 2,
        effectivePayoutOrder: 2,
        cycleStanding: "ACTIVE" as const,
      },
      {
        userId: "u3",
        turnOrder: 3,
        effectivePayoutOrder: 3,
        cycleStanding: "ACTIVE" as const,
      },
    ];

    const selection = selectPayoutRecipient(members, 1);
    expect(selection.recipient?.userId).toBe("u2");
    expect(selection.skippedDefaulted.map((m) => m.userId)).toContain("u1");
  });

  it("blocks when all members are defaulted", () => {
    const allDefaulted = ["u1", "u2"].map((userId, i) => ({
      userId,
      turnOrder: i + 1,
      effectivePayoutOrder: i + 1,
      cycleStanding: "DEFAULTED" as const,
    }));
    expect(selectPayoutRecipient(allDefaulted, 1).recipient).toBeNull();
  });
});

describe("PayoutsService", () => {
  const prisma = {
    group: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  };
  const allocation = { allocateCycleFinalizationInTx: vi.fn() };
  const reserve = { releaseAllActiveReservesOnGroupCompletedInTx: vi.fn() };
  const notifications = { create: vi.fn() };
  const audit = { append: vi.fn() };
  const cycleCompliance = { syncGroupCompliance: vi.fn() };
  const deposits = { releaseAllHeldDepositsForGroup: vi.fn() };

  let svc: PayoutsService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new PayoutsService(
      prisma as never,
      allocation as never,
      reserve as never,
      notifications as never,
      audit as never,
      cycleCompliance as never,
      deposits as never,
    );
  });

  it("records audit when defaulted members are skipped in payout metadata", async () => {
    const groupId = "g1";
    const finalizedBy = "admin-1";
    const payoutId = "payout-2";
    const skippedUserId = "u3";
    const recipientId = "u4";

    cycleCompliance.syncGroupCompliance.mockResolvedValue(undefined);
    const peekMembers = [
      {
        userId: "u1",
        turnOrder: 1,
        effectivePayoutOrder: 1,
        cycleStanding: MemberCycleStanding.ACTIVE,
      },
      {
        userId: "u2",
        turnOrder: 2,
        effectivePayoutOrder: 2,
        cycleStanding: MemberCycleStanding.ACTIVE,
      },
      {
        userId: skippedUserId,
        turnOrder: 3,
        effectivePayoutOrder: 6,
        cycleStanding: MemberCycleStanding.DEFAULTED,
      },
      {
        userId: recipientId,
        turnOrder: 4,
        effectivePayoutOrder: 4,
        cycleStanding: MemberCycleStanding.ACTIVE,
      },
      {
        userId: "u5",
        turnOrder: 5,
        effectivePayoutOrder: 5,
        cycleStanding: MemberCycleStanding.ACTIVE,
      },
    ];
    prisma.group.findUnique.mockResolvedValue({
      id: groupId,
      payoutMode: PayoutMode.CYCLE,
      allowPayoutOverride: false,
      members: peekMembers,
    });

    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const tx = {
        group: {
          findUnique: vi.fn().mockResolvedValue({
            id: groupId,
            status: "ACTIVE",
            currentCycle: 2,
            adminId: finalizedBy,
            payoutMode: PayoutMode.CYCLE,
            allowPayoutOverride: false,
            memberSlots: 5,
            contributionAmount: { toString: () => "100" },
            serviceMarginBps: 500,
            daysPerCycle: 10,
            members: [
              {
                userId: "u1",
                turnOrder: 1,
                effectivePayoutOrder: 1,
                cycleStanding: MemberCycleStanding.ACTIVE,
              },
              {
                userId: "u2",
                turnOrder: 2,
                effectivePayoutOrder: 2,
                cycleStanding: MemberCycleStanding.ACTIVE,
              },
              {
                userId: skippedUserId,
                turnOrder: 3,
                effectivePayoutOrder: 6,
                cycleStanding: MemberCycleStanding.DEFAULTED,
              },
              {
                userId: recipientId,
                turnOrder: 4,
                effectivePayoutOrder: 4,
                cycleStanding: MemberCycleStanding.ACTIVE,
              },
              {
                userId: "u5",
                turnOrder: 5,
                effectivePayoutOrder: 5,
                cycleStanding: MemberCycleStanding.ACTIVE,
              },
            ],
          }),
          update: vi.fn(),
        },
        contribution: {
          findMany: vi.fn().mockResolvedValue([
            { userId: "u1", status: ContributionStatus.PAID },
            { userId: "u2", status: ContributionStatus.PAID },
            { userId: skippedUserId, status: ContributionStatus.PENDING },
            { userId: recipientId, status: ContributionStatus.PAID },
            { userId: "u5", status: ContributionStatus.PAID },
          ]),
          create: vi.fn(),
        },
        payout: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({
            id: payoutId,
            recipientId,
            amount: { toString: () => "2850" },
            metadata: {
              payoutTurnSkippedDefaulted: [skippedUserId],
            },
          }),
        },
        adminEarning: { create: vi.fn() },
        groupMember: { updateMany: vi.fn() },
      };
      allocation.allocateCycleFinalizationInTx.mockResolvedValue({
        availableAmount: { toString: () => "2000" },
        reserveAmount: { toString: () => "850" },
      });
      reserve.releaseAllActiveReservesOnGroupCompletedInTx.mockResolvedValue([]);
      return fn(tx);
    });

    prisma.group.findUnique
      .mockResolvedValueOnce({
        id: groupId,
        payoutMode: PayoutMode.CYCLE,
        allowPayoutOverride: false,
        members: peekMembers,
      })
      .mockResolvedValueOnce({
        adminId: finalizedBy,
        name: "Test Group",
      });

    await svc.finalizeCycle(groupId, 2, finalizedBy, UserRole.ADMIN);

    expect(() =>
      assertCycleContributionsReadyForFinalize(
        [
          { userId: "u1", status: ContributionStatus.PAID },
          { userId: skippedUserId, status: ContributionStatus.PENDING },
          { userId: recipientId, status: ContributionStatus.PAID },
        ],
        [
          { userId: skippedUserId, cycleStanding: MemberCycleStanding.DEFAULTED },
          { userId: recipientId, cycleStanding: MemberCycleStanding.ACTIVE },
        ],
      ),
    ).not.toThrow();

    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PAYOUT_TURN_SKIPPED_DEFAULTED_MEMBER",
        entityId: payoutId,
        metadata: expect.objectContaining({
          skippedUserIds: [skippedUserId],
          recipientId,
        }),
      }),
    );
  });

  it("rejects finalize when all members are defaulted", async () => {
    cycleCompliance.syncGroupCompliance.mockResolvedValue(undefined);
    prisma.group.findUnique.mockResolvedValue({
      id: "g1",
      payoutMode: PayoutMode.CYCLE,
      allowPayoutOverride: false,
      members: [
        {
          userId: "u1",
          turnOrder: 1,
          effectivePayoutOrder: 1,
          cycleStanding: MemberCycleStanding.DEFAULTED,
        },
      ],
    });

    await expect(
      svc.finalizeCycle("g1", 1, "admin", UserRole.SUPER_ADMIN),
    ).rejects.toThrow(BadRequestException);
  });
});
