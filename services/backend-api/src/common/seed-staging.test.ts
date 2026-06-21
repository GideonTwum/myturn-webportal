import { describe, expect, it } from "vitest";
import {
  STAGING_GROUP_SPECS,
  STAGING_INVITE_DEMO,
  STAGING_INVITE_PAY,
} from "../../prisma/seed-staging.lib";

describe("seed-staging specs", () => {
  it("defines fixed invite codes", () => {
    const codes = STAGING_GROUP_SPECS.map((g) => g.inviteCode);
    expect(codes).toContain(STAGING_INVITE_DEMO);
    expect(codes).toContain(STAGING_INVITE_PAY);
  });

  it("uses joinable DRAFT-sized groups for staging UAT", () => {
    for (const spec of STAGING_GROUP_SPECS) {
      expect(spec.groupSize).toBeGreaterThanOrEqual(3);
      expect(spec.groupSize).toBeLessThanOrEqual(10);
      expect(spec.contributionAmount).toBeGreaterThan(0);
      expect(spec.daysPerCycle).toBeGreaterThan(0);
    }
  });
});
