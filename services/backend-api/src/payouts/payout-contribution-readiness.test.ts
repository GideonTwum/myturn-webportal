import { describe, expect, it } from "vitest";
import { BadRequestException } from "@nestjs/common";
import {
  ContributionStatus,
  MemberCycleStanding,
} from "@prisma/client";
import { assertCycleContributionsReadyForFinalize } from "./payout-contribution-readiness";

describe("assertCycleContributionsReadyForFinalize", () => {
  const members = [
    { userId: "u1", cycleStanding: MemberCycleStanding.ACTIVE },
    { userId: "u2", cycleStanding: MemberCycleStanding.ACTIVE },
    { userId: "u3", cycleStanding: MemberCycleStanding.DEFAULTED },
  ];

  it("allows finalize when only defaulted member is unpaid", () => {
    expect(() =>
      assertCycleContributionsReadyForFinalize(
        [
          { userId: "u1", status: ContributionStatus.PAID },
          { userId: "u2", status: ContributionStatus.PAID },
          { userId: "u3", status: ContributionStatus.PENDING },
        ],
        members,
      ),
    ).not.toThrow();
  });

  it("blocks finalize when non-defaulted member is unpaid", () => {
    expect(() =>
      assertCycleContributionsReadyForFinalize(
        [
          { userId: "u1", status: ContributionStatus.PAID },
          { userId: "u2", status: ContributionStatus.PENDING },
          { userId: "u3", status: ContributionStatus.PENDING },
        ],
        members,
      ),
    ).toThrow(BadRequestException);
  });

  it("blocks finalize when all non-defaulted are paid but one active member unpaid", () => {
    expect(() =>
      assertCycleContributionsReadyForFinalize(
        [
          { userId: "u1", status: ContributionStatus.PENDING },
          { userId: "u2", status: ContributionStatus.PAID },
        ],
        members.slice(0, 2),
      ),
    ).toThrow(/All contributions must be paid first/);
  });

  it("allows finalize when all contributions are paid", () => {
    expect(() =>
      assertCycleContributionsReadyForFinalize(
        members.map((m) => ({ userId: m.userId, status: ContributionStatus.PAID })),
        members,
      ),
    ).not.toThrow();
  });
});
