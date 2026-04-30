/**
 * Fixed MVP revenue rules — single source of truth in code.
 * Not editable via MyTurn HQ (staging-safe). MoMo integration is out of scope for MVP.
 */

/** Service margin as % of gross collected per cycle (e.g. 10 = 10%). */
export const SERVICE_MARGIN_PERCENTAGE = 10;

/** Admin’s share of the service margin (% of margin, not of gross). */
export const ADMIN_SHARE_PERCENTAGE = 60;

/** MyTurn (platform) share of the service margin (% of margin). */
export const MYTURN_SHARE_PERCENTAGE = 40;

export const BPS_DENOMINATOR = 10000;

/** Service margin as basis points of gross per cycle (10% → 1000). */
export const DEFAULT_SERVICE_MARGIN_BPS = Math.round(
  SERVICE_MARGIN_PERCENTAGE * 100,
);

/**
 * Admin’s portion of the margin pool, in bps of that pool (60% → 6000/10000).
 * Used with {@link BPS_DENOMINATOR} in integer math.
 */
export const ADMIN_MARGIN_SHARE_BPS =
  (ADMIN_SHARE_PERCENTAGE * BPS_DENOMINATOR) / 100;

/**
 * MyTurn’s nominal share in bps (40% → 4000/10000).
 * Settlement code may use (margin − adminShare) for the platform remainder to avoid drift.
 */
export const PLATFORM_MARGIN_SHARE_BPS =
  (MYTURN_SHARE_PERCENTAGE * BPS_DENOMINATOR) / 100;
