import { describe, expect, it } from "vitest";
import {
  marginFromGrossMinor,
  splitMarginMinor,
  summarizeCycle,
} from "./calculations";

describe("summarizeCycle (service margin → 100% MyTurn revenue)", () => {
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

  it("allocates 100% of margin to MyTurn (admin share is 0)", () => {
    const s = summarizeCycle(1, tenCedis, n, marginBps, 1);
    const { adminShareMinor, platformShareMinor } = splitMarginMinor(
      s.serviceMarginMinor,
    );
    expect(adminShareMinor).toBe(0n);
    expect(adminShareMinor).toBe(s.adminShareMinor);
    expect(platformShareMinor).toBe(s.platformShareMinor);
    expect(platformShareMinor).toBe(s.serviceMarginMinor);
  });

  it("member payout equals gross minus margin (net after margin)", () => {
    const s = summarizeCycle(1, tenCedis, n, marginBps, 1);
    const gross = tenCedis * BigInt(n);
    const margin = marginFromGrossMinor(gross, marginBps);
    expect(s.netAfterMarginMinor).toBe(gross - margin);
  });
});
