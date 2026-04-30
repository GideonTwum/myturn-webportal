import { describe, expect, it } from "vitest";
import {
  marginFromGrossMinor,
  splitMarginMinor,
  summarizeCycle,
} from "./calculations";

describe("summarizeCycle (MVP margin + 60/40 split)", () => {
  /** GHS 10.00 per day in minor units */
  const tenCedis = 1000n;
  const n = 4;
  /** 10% service margin → 1000 bps */
  const marginBps = 1000;

  it("applies service margin as % of gross (single day per cycle)", () => {
    const s = summarizeCycle(1, tenCedis, n, marginBps, 1);
    const gross = tenCedis * BigInt(n);
    const expectedMargin = (gross * BigInt(marginBps)) / 10000n;
    expect(s.grossPoolAmountMinor).toBe(gross);
    expect(s.serviceMarginMinor).toBe(expectedMargin);
    expect(s.netAfterMarginMinor).toBe(gross - expectedMargin);
  });

  it("multiplies gross by daysPerCycle", () => {
    const days = 7;
    const s = summarizeCycle(1, tenCedis, n, marginBps, days);
    const gross = tenCedis * BigInt(n) * BigInt(days);
    expect(s.grossPoolAmountMinor).toBe(gross);
    const expectedMargin = (gross * BigInt(marginBps)) / 10000n;
    expect(s.serviceMarginMinor).toBe(expectedMargin);
  });

  it("splits margin 60% admin / 40% platform (of margin, not gross)", () => {
    const s = summarizeCycle(1, tenCedis, n, marginBps, 1);
    const { adminShareMinor, platformShareMinor } = splitMarginMinor(
      s.serviceMarginMinor,
    );
    expect(adminShareMinor).toBe(s.adminShareMinor);
    expect(platformShareMinor).toBe(s.platformShareMinor);
    expect(adminShareMinor + platformShareMinor).toBe(s.serviceMarginMinor);

    const adminPct =
      Number((adminShareMinor * 10000n) / s.serviceMarginMinor) / 100;
    expect(adminPct).toBeCloseTo(60, 1);
    const platPct =
      Number((platformShareMinor * 10000n) / s.serviceMarginMinor) / 100;
    expect(platPct).toBeCloseTo(40, 1);
  });

  it("member payout equals gross minus 10% margin (net after margin)", () => {
    const s = summarizeCycle(1, tenCedis, n, marginBps, 1);
    const gross = tenCedis * BigInt(n);
    const margin = marginFromGrossMinor(gross, marginBps);
    expect(s.netAfterMarginMinor).toBe(gross - margin);
  });
});
