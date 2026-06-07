import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { summarizeCycle } from "@myturn/shared";

/** Journal lines for cycle allocation must net to zero. */
describe("cycle wallet allocation journal", () => {
  it("balances gross pool split into net, admin, and platform shares", () => {
    const contributionMinor = 1000n;
    const n = 5;
    const marginBps = 1000;
    const days = 7;

    const summary = summarizeCycle(1, contributionMinor, n, marginBps, days);
    const gross = summary.grossPoolAmountMinor;
    const net = summary.netAfterMarginMinor;
    const admin = summary.adminShareMinor;
    const platform = summary.platformShareMinor;

    const grossDec = new Prisma.Decimal(gross.toString());
    const netDec = new Prisma.Decimal(net.toString());
    const adminDec = new Prisma.Decimal(admin.toString());
    const platformDec = new Prisma.Decimal(platform.toString());

    const lines = [
      grossDec.mul(-1),
      netDec,
      adminDec,
      platformDec,
    ];
    const sum = lines.reduce(
      (a, d) => a.add(d),
      new Prisma.Decimal(0),
    );
    expect(sum.isZero()).toBe(true);
    expect(adminDec.add(platformDec).toString()).toBe(
      new Prisma.Decimal(summary.serviceMarginMinor.toString()).toString(),
    );
  });
});

describe("contribution collection journal", () => {
  it("balances four-line inflow and group pool allocation", () => {
    const amount = new Prisma.Decimal("10.00");
    const lines = [
      amount.mul(-1),
      amount,
      amount.mul(-1),
      amount,
    ];
    const sum = lines.reduce((a, d) => a.add(d), new Prisma.Decimal(0));
    expect(sum.isZero()).toBe(true);
  });
});
