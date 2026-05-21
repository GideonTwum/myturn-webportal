import { BPS_DENOMINATOR } from "./constants";
import { PayoutMode, type PayoutModeLiteral } from "./enums";

/** Minimum service margin: 2% → 200 bps. */
export const MIN_SERVICE_MARGIN_BPS = 200;

/** MyTurn recommended default when the pool tier allows it: 10% → 1000 bps. */
export const RECOMMENDED_SERVICE_MARGIN_BPS = 1000;

/** GHS tier upper bounds (whole currency units) for max margin lookup. */
const TIER_MAX_GHS = [1000, 5000, 20_000] as const;

/** Max margin bps per tier (5%, 10%, 15%, 20%). */
const TIER_MAX_BPS = [500, 1000, 1500, 2000] as const;

/** 100 minor units = 1.00 GHS. */
export const GHS_MINOR_PER_UNIT = 100;

export type MarginBounds = {
  grossPoolAmountMinor: bigint;
  minAllowedMarginBps: number;
  maxAllowedMarginBps: number;
  recommendedMarginBps: number;
};

export function getMinAllowedMarginBps(): number {
  return MIN_SERVICE_MARGIN_BPS;
}

/**
 * Max allowed service margin (bps) from gross pool size in minor units (1 GHS = 100 minor).
 *
 * | Gross (GHS)   | Max margin |
 * |---------------|------------|
 * | 0 – 1,000     | 5%         |
 * | 1,001 – 5,000 | 10%        |
 * | 5,001 – 20,000| 15%        |
 * | 20,001+       | 20%        |
 */
export function getMaxAllowedMarginBps(grossPoolAmountMinor: bigint): number {
  if (grossPoolAmountMinor < 0n) {
    throw new Error("grossPoolAmountMinor must be non-negative");
  }
  const ghsWhole = grossPoolAmountMinor / BigInt(GHS_MINOR_PER_UNIT);
  if (ghsWhole <= BigInt(TIER_MAX_GHS[0])) {
    return TIER_MAX_BPS[0];
  }
  if (ghsWhole <= BigInt(TIER_MAX_GHS[1])) {
    return TIER_MAX_BPS[1];
  }
  if (ghsWhole <= BigInt(TIER_MAX_GHS[2])) {
    return TIER_MAX_BPS[2];
  }
  return TIER_MAX_BPS[3];
}

export function getMarginBounds(grossPoolAmountMinor: bigint): MarginBounds {
  const maxAllowedMarginBps = getMaxAllowedMarginBps(grossPoolAmountMinor);
  const recommendedMarginBps = Math.min(
    RECOMMENDED_SERVICE_MARGIN_BPS,
    maxAllowedMarginBps,
  );
  return {
    grossPoolAmountMinor,
    minAllowedMarginBps: MIN_SERVICE_MARGIN_BPS,
    maxAllowedMarginBps,
    recommendedMarginBps,
  };
}

/** Default selection: 10% when allowed, otherwise the tier maximum. */
export function resolveDefaultServiceMarginBps(grossPoolAmountMinor: bigint): number {
  return getMarginBounds(grossPoolAmountMinor).recommendedMarginBps;
}

export function bpsToPercentage(bps: number): number {
  return bps / 100;
}

export function percentageToBps(percent: number): number {
  return Math.round(percent * 100);
}

export function clampServiceMarginBps(
  bps: number,
  grossPoolAmountMinor: bigint,
): number {
  const { minAllowedMarginBps, maxAllowedMarginBps } =
    getMarginBounds(grossPoolAmountMinor);
  return Math.min(
    maxAllowedMarginBps,
    Math.max(minAllowedMarginBps, Math.round(bps)),
  );
}

export type ValidateServiceMarginResult =
  | { ok: true; serviceMarginBps: number }
  | { ok: false; reason: string };

export function validateServiceMarginBps(
  serviceMarginBps: number,
  grossPoolAmountMinor: bigint,
): ValidateServiceMarginResult {
  if (!Number.isFinite(serviceMarginBps) || !Number.isInteger(serviceMarginBps)) {
    return { ok: false, reason: "Service margin must be a whole number of basis points" };
  }
  if (serviceMarginBps < MIN_SERVICE_MARGIN_BPS) {
    return {
      ok: false,
      reason: `Service margin must be at least ${bpsToPercentage(MIN_SERVICE_MARGIN_BPS)}%`,
    };
  }
  const max = getMaxAllowedMarginBps(grossPoolAmountMinor);
  if (serviceMarginBps > max) {
    const grossGhs = Number(grossPoolAmountMinor) / GHS_MINOR_PER_UNIT;
    return {
      ok: false,
      reason: `Service margin ${bpsToPercentage(serviceMarginBps)}% exceeds the maximum ${bpsToPercentage(max)}% allowed for a gross pool of GHS ${grossGhs.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    };
  }
  if (serviceMarginBps > BPS_DENOMINATOR) {
    return { ok: false, reason: "Service margin cannot exceed 100%" };
  }
  return { ok: true, serviceMarginBps };
}

/** Gross pool minor units from group parameters (matches {@link grossPoolAmountMinor}). */
export function computeGrossPoolMinorFromParams(
  contributionAmount: number,
  groupSize: number,
  payoutMode: PayoutModeLiteral | undefined,
  daysPerCycle?: number,
): bigint {
  const mode = payoutMode === "DAILY" ? PayoutMode.DAILY : PayoutMode.CYCLE;
  const days =
    mode === PayoutMode.DAILY
      ? 1
      : daysPerCycle != null && daysPerCycle >= 1
        ? daysPerCycle
        : 1;
  const contributionMinor = BigInt(
    Math.round(contributionAmount * GHS_MINOR_PER_UNIT),
  );
  return contributionMinor * BigInt(groupSize) * BigInt(days);
}
