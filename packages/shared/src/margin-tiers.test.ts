import { describe, expect, it } from "vitest";
import { grossPoolAmountMinor } from "./calculations";
import { computeGroupFinancePreview } from "./finance";
import { PayoutMode } from "./enums";
import {
  GHS_MINOR_PER_UNIT,
  getMaxAllowedMarginBps,
  getMinAllowedMarginBps,
  resolveDefaultServiceMarginBps,
  validateServiceMarginBps,
} from "./margin-tiers";

describe("margin tiers (gross pool in minor units)", () => {
  it("getMinAllowedMarginBps is 2%", () => {
    expect(getMinAllowedMarginBps()).toBe(200);
  });

  it("max margin by gross pool tier", () => {
    expect(getMaxAllowedMarginBps(1000n * BigInt(GHS_MINOR_PER_UNIT))).toBe(500);
    expect(getMaxAllowedMarginBps(1001n * BigInt(GHS_MINOR_PER_UNIT))).toBe(1000);
    expect(getMaxAllowedMarginBps(5000n * BigInt(GHS_MINOR_PER_UNIT))).toBe(1000);
    expect(getMaxAllowedMarginBps(5001n * BigInt(GHS_MINOR_PER_UNIT))).toBe(1500);
    expect(getMaxAllowedMarginBps(20_000n * BigInt(GHS_MINOR_PER_UNIT))).toBe(1500);
    expect(getMaxAllowedMarginBps(20_001n * BigInt(GHS_MINOR_PER_UNIT))).toBe(2000);
  });

  it("rejects margin below minimum", () => {
    const gross = 500n * BigInt(GHS_MINOR_PER_UNIT);
    const r = validateServiceMarginBps(100, gross);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("2%");
  });

  it("rejects margin above tier max", () => {
    const gross = 400n * BigInt(GHS_MINOR_PER_UNIT);
    const r = validateServiceMarginBps(1000, gross);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("maximum");
  });

  it("accepts margin within tier", () => {
    const gross = 4000n * BigInt(GHS_MINOR_PER_UNIT);
    expect(validateServiceMarginBps(800, gross).ok).toBe(true);
  });

  it("defaults to 10% when tier allows, else max", () => {
    expect(resolveDefaultServiceMarginBps(500n * BigInt(GHS_MINOR_PER_UNIT))).toBe(
      500,
    );
    expect(resolveDefaultServiceMarginBps(4000n * BigInt(GHS_MINOR_PER_UNIT))).toBe(
      1000,
    );
  });
});

describe("computeGroupFinancePreview with dynamic margin", () => {
  const startDate = "2026-06-01";

  it("DAILY mode: gross = contribution × size, margin bounds apply", () => {
    const r = computeGroupFinancePreview({
      contributionAmount: 50,
      groupSize: 10,
      payoutMode: "DAILY",
      startDate,
      serviceMarginBps: 500,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.preview.payoutMode).toBe(PayoutMode.DAILY);
    expect(r.preview.daysPerCycle).toBe(1);
    expect(r.preview.totalCollectedPerCycle).toBe(500);
    expect(r.preview.maxAllowedMarginBps).toBe(500);
    expect(r.preview.serviceMarginBps).toBe(500);
    expect(r.preview.serviceMarginPerCycle).toBe(25);
    expect(r.preview.payoutAmountPerCycle).toBe(475);
    expect(r.preview.adminEarningPerCycle).toBe(0);
    expect(r.preview.myTurnEarningPerCycle).toBe(25);
  });

  it("CYCLE mode: gross includes daysPerCycle", () => {
    const r = computeGroupFinancePreview({
      contributionAmount: 10,
      groupSize: 5,
      payoutMode: "CYCLE",
      daysPerCycle: 7,
      startDate,
      serviceMarginBps: 500,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.preview.totalCollectedPerCycle).toBe(350);
    const grossMinor = grossPoolAmountMinor(1000n, 5, 7);
    expect(grossMinor).toBe(35000n);
    expect(r.preview.maxAllowedMarginBps).toBe(500);
    expect(r.preview.serviceMarginPerCycle).toBe(17.5);
  });

  it("rejects invalid margin for pool tier", () => {
    const r = computeGroupFinancePreview({
      contributionAmount: 10,
      groupSize: 5,
      payoutMode: "DAILY",
      startDate,
      serviceMarginBps: 1500,
    });
    expect(r.ok).toBe(false);
  });

  it("matches summarizeCycle settlement math for selected bps", () => {
    const r = computeGroupFinancePreview({
      contributionAmount: 100,
      groupSize: 5,
      payoutMode: "CYCLE",
      daysPerCycle: 3,
      startDate,
      serviceMarginBps: 1000,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.preview.serviceMarginBps).toBe(1000);
    expect(r.preview.totalCollectedPerCycle).toBe(1500);
    expect(r.preview.payoutAmountPerCycle).toBe(1350);
  });
});
