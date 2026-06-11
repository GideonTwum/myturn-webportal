import { PLATFORM_MARGIN_SHARE_BPS, BPS_DENOMINATOR } from "./constants";
import type { CycleSummary } from "./enums";

function assertNonNegative(n: bigint, name: string) {
  if (n < 0n) throw new Error(`${name} must be non-negative`);
}

/**
 * Gross pool for one cycle: per-day contribution × members × days in the cycle.
 */
export function grossPoolAmountMinor(
  contributionPerDayMinor: bigint,
  contributingMemberCount: number,
  daysPerCycle: number = 1,
): bigint {
  if (contributingMemberCount < 0)
    throw new Error("contributingMemberCount invalid");
  if (daysPerCycle < 1 || !Number.isInteger(daysPerCycle)) {
    throw new Error("daysPerCycle must be a positive integer");
  }
  assertNonNegative(contributionPerDayMinor, "contributionPerDayMinor");
  return (
    contributionPerDayMinor *
    BigInt(contributingMemberCount) *
    BigInt(daysPerCycle)
  );
}

/** Margin in minor units from gross using basis points (e.g. 1000 = 10%). */
export function marginFromGrossMinor(
  grossMinor: bigint,
  marginBps: number,
): bigint {
  assertNonNegative(grossMinor, "grossMinor");
  if (marginBps < 0 || marginBps > BPS_DENOMINATOR) {
    throw new Error("marginBps must be between 0 and 10000");
  }
  return (grossMinor * BigInt(marginBps)) / BigInt(BPS_DENOMINATOR);
}

/**
 * Split margin: 100% MyTurn revenue. Admin share is always 0.
 * {@link adminShareMinor} retained for API/ledger compatibility.
 */
export function splitMarginMinor(marginMinor: bigint): {
  adminShareMinor: bigint;
  platformShareMinor: bigint;
} {
  assertNonNegative(marginMinor, "marginMinor");
  const adminShareMinor = 0n;
  const platformShareMinor =
    (marginMinor * BigInt(PLATFORM_MARGIN_SHARE_BPS)) / BigInt(BPS_DENOMINATOR);
  return { adminShareMinor, platformShareMinor };
}

/** Full cycle financial breakdown */
export function summarizeCycle(
  cycleNumber: number,
  contributionPerDayMinor: bigint,
  contributingMemberCount: number,
  marginBps: number,
  daysPerCycle: number = 1,
): CycleSummary {
  const gross = grossPoolAmountMinor(
    contributionPerDayMinor,
    contributingMemberCount,
    daysPerCycle,
  );
  const serviceMargin = marginFromGrossMinor(gross, marginBps);
  const netAfter = gross - serviceMargin;
  const { adminShareMinor, platformShareMinor } =
    splitMarginMinor(serviceMargin);
  return {
    cycleNumber,
    grossPoolAmountMinor: gross,
    serviceMarginMinor: serviceMargin,
    netAfterMarginMinor: netAfter,
    adminShareMinor,
    platformShareMinor,
  };
}

export function payoutToRecipientMinor(netAfterMarginMinor: bigint): bigint {
  assertNonNegative(netAfterMarginMinor, "netAfterMarginMinor");
  return netAfterMarginMinor;
}
