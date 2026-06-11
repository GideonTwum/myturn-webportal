import { BPS_DENOMINATOR } from "./constants";

export type ContributionReserveConfig = {
  enabled: boolean;
  maxBps: number;
  minBps: number;
  /** @deprecated Ignored — reserve is percentage-based only (no GHS cap). */
  maxAmountMinor?: bigint;
};

/**
 * Linear decline reserve by payout position (1-indexed).
 * Reserve BPS = maxBps × (totalPositions − payoutPosition) / totalPositions
 * Last position receives 0%.
 */
export function computeReserveBps(
  payoutPosition: number,
  totalPositions: number,
  maxBps: number,
  minBps = 0,
): number {
  if (totalPositions < 1) throw new Error("totalPositions must be >= 1");
  if (payoutPosition < 1 || payoutPosition > totalPositions) {
    throw new Error("payoutPosition out of range");
  }
  if (maxBps < 0 || maxBps > BPS_DENOMINATOR) {
    throw new Error("maxBps must be between 0 and 10000");
  }
  if (payoutPosition >= totalPositions) return 0;
  const remainingPositions = totalPositions - payoutPosition;
  const raw = Math.floor((maxBps * remainingPositions) / totalPositions);
  return Math.max(minBps, Math.min(maxBps, raw));
}

/** Reserve amount in minor units from net payout (percentage-based only). */
export function computeReserveAmountMinor(
  netPayoutMinor: bigint,
  reserveBps: number,
): bigint {
  if (netPayoutMinor < 0n) throw new Error("netPayoutMinor must be non-negative");
  if (reserveBps <= 0) return 0n;
  return (netPayoutMinor * BigInt(reserveBps)) / BigInt(BPS_DENOMINATOR);
}

/** Per payment-unit release before final cleanup. */
export function computeReleasePerUnitMinor(
  originalReserveMinor: bigint,
  remainingContributionUnits: number,
): bigint {
  if (remainingContributionUnits < 1) return 0n;
  return originalReserveMinor / BigInt(remainingContributionUnits);
}

/** @deprecated Use computeReleasePerUnitMinor */
export const computeReleasePerContributionMinor = computeReleasePerUnitMinor;

/**
 * Next release amount; final unit absorbs rounding remainder.
 */
export function nextReserveReleaseMinor(
  originalReserveMinor: bigint,
  remainingReserveMinor: bigint,
  remainingContributionUnits: number,
  unitsReleasedCount: number,
): bigint {
  if (remainingReserveMinor <= 0n || remainingContributionUnits < 1) return 0n;
  const isLast = unitsReleasedCount + 1 >= remainingContributionUnits;
  if (isLast) return remainingReserveMinor;
  return computeReleasePerUnitMinor(
    originalReserveMinor,
    remainingContributionUnits,
  );
}

/** Post-payout contribution cycles remaining for a recipient. */
export function postPayoutContributionCount(
  payoutPosition: number,
  totalPositions: number,
): number {
  if (totalPositions < 1) return 0;
  return Math.max(0, totalPositions - payoutPosition);
}

/**
 * Post-payout payment units (days or lump payments) remaining after payout.
 * DAILY mode: 1 unit per remaining cycle. CYCLE mode: daysPerCycle units per remaining cycle.
 */
export function postPayoutContributionUnits(
  payoutPosition: number,
  totalPositions: number,
  paymentUnitsPerCycle: number,
): number {
  if (paymentUnitsPerCycle < 1) throw new Error("paymentUnitsPerCycle must be >= 1");
  return (
    postPayoutContributionCount(payoutPosition, totalPositions) *
    paymentUnitsPerCycle
  );
}
