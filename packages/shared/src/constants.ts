/**
 * Revenue rules — service margin % is pool-tiered per group.
 * Margin revenue is 100% MyTurn platform revenue (admins are operational, not beneficiaries).
 */

/** Recommended default service margin when the pool tier allows (e.g. 10 = 10%). */
export const SERVICE_MARGIN_PERCENTAGE = 10;

/** MyTurn receives 100% of service margin revenue. */
export const MYTURN_REVENUE_PERCENTAGE = 100;

/** @deprecated Admins no longer receive margin share. Always 0. Kept for migration safety. */
export const ADMIN_SHARE_PERCENTAGE = 0;

/** MyTurn (platform) share of the service margin (% of margin). */
export const MYTURN_SHARE_PERCENTAGE = MYTURN_REVENUE_PERCENTAGE;

export const BPS_DENOMINATOR = 10000;

/** Service margin as basis points of gross per cycle (10% → 1000). */
export const DEFAULT_SERVICE_MARGIN_BPS = Math.round(
  SERVICE_MARGIN_PERCENTAGE * 100,
);

/**
 * @deprecated Admin margin share removed. Always 0 bps. Kept for migration safety.
 */
export const ADMIN_MARGIN_SHARE_BPS = 0;

/** MyTurn receives full margin pool (100% → 10000/10000). */
export const PLATFORM_MARGIN_SHARE_BPS = MYTURN_REVENUE_PERCENTAGE * 100;
