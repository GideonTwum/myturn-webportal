import { describe, expect, it } from "vitest";
import {
  computeReserveAmountMinor,
  computeReserveBps,
  nextReserveReleaseMinor,
  postPayoutContributionCount,
  postPayoutContributionUnits,
} from "./contribution-reserve";

const BPS = 3000;

describe("computeReserveBps", () => {
  it("gives ~30% for position 1 in 200-member group", () => {
    expect(computeReserveBps(1, 200, BPS)).toBe(2985);
  });

  it("gives 15% for position 100 in 200-member group", () => {
    expect(computeReserveBps(100, 200, BPS)).toBe(1500);
  });

  it("gives 0% for last recipient in 200-member group", () => {
    expect(computeReserveBps(200, 200, BPS)).toBe(0);
  });

  it("gives 24% for position 1 in 5-member group", () => {
    expect(computeReserveBps(1, 5, BPS)).toBe(2400);
  });

  it("gives 0% for last recipient in 5-member group", () => {
    expect(computeReserveBps(5, 5, BPS)).toBe(0);
  });
});

describe("computeReserveAmountMinor", () => {
  it("reserves 30% of GHS 60,000 net payout (GHS 18,000)", () => {
    const net = 6_000_000n; // GHS 60,000 in minor units
    expect(computeReserveAmountMinor(net, 3000)).toBe(1_800_000n);
  });

  it("does not apply a deprecated GHS cap — percentage only", () => {
    const net = 6_000_000n;
    const reserve = computeReserveAmountMinor(net, 3000);
    expect(reserve).toBe(1_800_000n);
    expect(reserve).not.toBe(300_000n);
  });

  it("returns 0 when reserve bps is 0", () => {
    expect(computeReserveAmountMinor(500_000n, 0)).toBe(0n);
  });

  it("applies 24% for 5-member position 1 on GHS 18,000 net", () => {
    const net = 1_800_000n;
    const bps = computeReserveBps(1, 5, BPS);
    expect(bps).toBe(2400);
    expect(computeReserveAmountMinor(net, bps)).toBe(432_000n);
  });
});

describe("nextReserveReleaseMinor", () => {
  it("releases equal installments until final cleanup", () => {
    const original = 300_000n;
    let remaining = original;
    const count = 9;
    let released = 0;
    for (let i = 0; i < count; i++) {
      const amount = nextReserveReleaseMinor(
        original,
        remaining,
        count,
        released,
      );
      remaining -= amount;
      released++;
    }
    expect(remaining).toBe(0n);
  });

  it("final release absorbs rounding remainder", () => {
    const original = 300_000n;
    const count = 9;
    const per = original / BigInt(count);
    let sum = 0n;
    for (let i = 0; i < count - 1; i++) sum += per;
    const last = nextReserveReleaseMinor(
      original,
      original - sum,
      count,
      count - 1,
    );
    expect(sum + last).toBe(original);
  });

  it("releases GHS 450 per unit from GHS 18,000 over 40 units", () => {
    const original = 1_800_000n;
    const units = 40;
    const per = nextReserveReleaseMinor(original, original, units, 0);
    expect(per).toBe(45_000n);
  });
});

describe("postPayoutContributionCount", () => {
  it("returns remaining cycles after payout position", () => {
    expect(postPayoutContributionCount(1, 200)).toBe(199);
    expect(postPayoutContributionCount(200, 200)).toBe(0);
  });
});

describe("postPayoutContributionUnits", () => {
  it("counts remaining daily payment days for cycle mode", () => {
    expect(postPayoutContributionUnits(170, 200, 30)).toBe(900);
  });

  it("counts one unit per remaining cycle for daily lump mode", () => {
    expect(postPayoutContributionUnits(1, 10, 1)).toBe(9);
  });

  it("matches 40 remaining units example for release denominator", () => {
    expect(postPayoutContributionUnits(160, 200, 1)).toBe(40);
  });
});
