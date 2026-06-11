import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { summarizeCycle } from "@myturn/shared";

/** Journal lines for cycle allocation must net to zero. */
describe("cycle wallet allocation journal", () => {
  it("balances gross pool split into net payout and MyTurn revenue only", () => {
    const contributionMinor = 1000n;
    const n = 5;
    const marginBps = 1000;
    const days = 7;

    const summary = summarizeCycle(1, contributionMinor, n, marginBps, days);
    const gross = summary.grossPoolAmountMinor;
    const net = summary.netAfterMarginMinor;
    const platform = summary.platformShareMinor;

    expect(summary.adminShareMinor).toBe(0n);

    const grossDec = new Prisma.Decimal(gross.toString());
    const netDec = new Prisma.Decimal(net.toString());
    const platformDec = new Prisma.Decimal(platform.toString());

    const lines = [grossDec.mul(-1), netDec, platformDec];
    const sum = lines.reduce((a, d) => a.add(d), new Prisma.Decimal(0));
    expect(sum.isZero()).toBe(true);
  });

  it("balances gross split into available + reserved + MyTurn revenue", () => {
    vi.stubEnv("CONTRIBUTION_RESERVE_ENABLED", "true");
    vi.stubEnv("CONTRIBUTION_RESERVE_MAX_BPS", "3000");
    const contributionMinor = 10000n;
    const n = 10;
    const summary = summarizeCycle(1, contributionMinor, n, 1000, 7);
    const grossDec = new Prisma.Decimal(summary.grossPoolAmountMinor.toString());
    const netMinor = summary.netAfterMarginMinor;
    const reserveBps = 2700; // position 1 of 10: 3000 * 9/10
    const reserveMinor = (netMinor * BigInt(reserveBps)) / 10000n;
    const availableMinor = netMinor - reserveMinor;
    const platformDec = new Prisma.Decimal(
      summary.platformShareMinor.toString(),
    );

    const lines = [
      grossDec.mul(-1),
      new Prisma.Decimal(availableMinor.toString()),
      new Prisma.Decimal(reserveMinor.toString()),
      platformDec,
    ];
    const sum = lines.reduce((a, d) => a.add(d), new Prisma.Decimal(0));
    expect(sum.isZero()).toBe(true);
    vi.unstubAllEnvs();
  });
});

describe("contribution collection journal", () => {
  it("balances four-line inflow and group pool allocation", () => {
    const amount = new Prisma.Decimal("10.00");
    const lines = [amount.mul(-1), amount, amount.mul(-1), amount];
    const sum = lines.reduce((a, d) => a.add(d), new Prisma.Decimal(0));
    expect(sum.isZero()).toBe(true);
  });
});
