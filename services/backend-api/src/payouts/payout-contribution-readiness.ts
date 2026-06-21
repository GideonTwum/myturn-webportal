import { BadRequestException } from "@nestjs/common";
import { ContributionStatus, MemberCycleStanding } from "@prisma/client";

export type CycleContributionRow = {
  userId: string;
  status: ContributionStatus;
};

export type CycleMemberStanding = {
  userId: string;
  cycleStanding: MemberCycleStanding;
};

/**
 * Non-defaulted members must have PAID contributions for the cycle.
 * DEFAULTED members may have unpaid contributions without blocking payout finalization.
 */
export function assertCycleContributionsReadyForFinalize(
  contribs: CycleContributionRow[],
  members: CycleMemberStanding[],
): void {
  const defaultedUserIds = new Set(
    members
      .filter((m) => m.cycleStanding === MemberCycleStanding.DEFAULTED)
      .map((m) => m.userId),
  );

  const blockingUnpaid = contribs.filter(
    (c) =>
      c.status !== ContributionStatus.PAID && !defaultedUserIds.has(c.userId),
  );

  if (blockingUnpaid.length > 0) {
    throw new BadRequestException("All contributions must be paid first");
  }
}
