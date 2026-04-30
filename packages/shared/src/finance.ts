import {
  ADMIN_SHARE_PERCENTAGE,
  MYTURN_SHARE_PERCENTAGE,
  SERVICE_MARGIN_PERCENTAGE,
} from "./constants";
import { PayoutMode, type PayoutModeLiteral } from "./enums";

/** Schedule unit for contribution interval (admin form). */
export type FrequencyUnit = "day" | "week" | "month";

/**
 * Revenue rule shape (fixed for MVP via {@link getFixedGroupFinancePlatformSettings}).
 * Persists only for typing / API compatibility — not edited in HQ.
 */
export type GroupFinancePlatformSettings = {
  serviceMarginPercentage: number;
  adminSplitPercentage: number;
  myTurnSplitPercentage: number;
};

export const DEFAULT_GROUP_FINANCE_PLATFORM_SETTINGS: GroupFinancePlatformSettings =
  {
    serviceMarginPercentage: SERVICE_MARGIN_PERCENTAGE,
    adminSplitPercentage: ADMIN_SHARE_PERCENTAGE,
    myTurnSplitPercentage: MYTURN_SHARE_PERCENTAGE,
  };

/** Fixed MVP rules: same values as group preview, payout settlement, and HQ reporting. */
export function getFixedGroupFinancePlatformSettings(): GroupFinancePlatformSettings {
  return { ...DEFAULT_GROUP_FINANCE_PLATFORM_SETTINGS };
}

/** @deprecated Finance rules are fixed in code; DB key unused for MVP. */
export const PLATFORM_FINANCE_SETTING_KEY = "platform.finance";

export type GroupFinancePreviewInput = {
  /**
   * Per-unit contribution (GHS): for {@link PayoutMode.CYCLE} this is the daily amount;
   * for {@link PayoutMode.DAILY} it is the single per-member payment each cycle.
   */
  contributionAmount: number;
  groupSize: number;
  /**
   * How funds are collected before each payout. Defaults to {@link PayoutMode.CYCLE}
   * when omitted (legacy callers).
   */
  payoutMode?: PayoutModeLiteral;
  /**
   * For {@link PayoutMode.CYCLE} only: calendar days in a cycle (members pay daily × this).
   * Ignored for {@link PayoutMode.DAILY} (preview uses one calendar step and gross = amount × size).
   */
  daysPerCycle?: number;
  /** Calendar date `YYYY-MM-DD` (parsed as UTC calendar). */
  startDate: string;
  /**
   * Optional. When omitted, {@link getFixedGroupFinancePlatformSettings} is used
   * so preview matches backend settlement exactly.
   */
  platformSettings?: GroupFinancePlatformSettings;
};

export type PayoutScheduleRow = {
  cycle: number;
  payoutDate: string;
};

export type GroupFinancePreview = {
  payoutMode: PayoutMode;
  /** Effective calendar days between payouts (always 1 for DAILY). */
  daysPerCycle: number;
  totalCollectedPerCycle: number;
  serviceMarginPerCycle: number;
  payoutAmountPerCycle: number;
  adminEarningPerCycle: number;
  myTurnEarningPerCycle: number;
  totalCycles: number;
  totalAdminEarnings: number;
  totalMyTurnEarnings: number;
  /** ISO `YYYY-MM-DD` — `startDate + groupSize × calendarDaysPerCycle`. */
  endDate: string;
  /** Payout date after each cycle: `startDate + i × calendarDaysPerCycle`, i = 1..groupSize. */
  payoutSchedule: PayoutScheduleRow[];
  /** Derived for storage (e.g. 10% → 1000 bps). */
  serviceMarginBps: number;
};

export type ComputeGroupFinancePreviewResult =
  | { ok: true; preview: GroupFinancePreview }
  | { ok: false; reason: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Merge with defaults, validate ranges and admin + MyTurn = 100. */
export function resolveGroupFinancePlatformSettings(
  partial?: Partial<GroupFinancePlatformSettings>,
): GroupFinancePlatformSettings {
  const s: GroupFinancePlatformSettings = {
    ...DEFAULT_GROUP_FINANCE_PLATFORM_SETTINGS,
    ...partial,
  };
  const sum = s.adminSplitPercentage + s.myTurnSplitPercentage;
  if (Math.abs(sum - 100) > 1e-6) {
    throw new Error(
      `adminSplitPercentage + myTurnSplitPercentage must equal 100 (got ${sum})`,
    );
  }
  if (
    s.serviceMarginPercentage < 0 ||
    s.serviceMarginPercentage > 100 ||
    s.adminSplitPercentage < 0 ||
    s.adminSplitPercentage > 100 ||
    s.myTurnSplitPercentage < 0 ||
    s.myTurnSplitPercentage > 100
  ) {
    throw new Error("Percentages must be between 0 and 100");
  }
  return s;
}

/**
 * Convert legacy interval schedule to days (month ≈ 30 for MVP).
 * @deprecated Kept for older callers only; new groups use daily {@link GroupFinancePreviewInput.daysPerCycle}.
 */
export function frequencyToDays(
  frequencyValue: number,
  frequencyUnit: FrequencyUnit,
): number {
  if (frequencyValue <= 0 || !Number.isFinite(frequencyValue)) {
    throw new Error("frequencyValue must be positive");
  }
  switch (frequencyUnit) {
    case "day":
      return frequencyValue;
    case "week":
      return frequencyValue * 7;
    case "month":
      return frequencyValue * 30;
    default:
      throw new Error(`Unknown frequencyUnit: ${frequencyUnit}`);
  }
}

function roundCurrency2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function parseStartDate(startDate: string): { y: number; m: number; d: number } {
  if (!ISO_DATE.test(startDate)) {
    throw new Error("startDate must be YYYY-MM-DD");
  }
  const [ys, ms, ds] = startDate.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) {
    throw new Error("Invalid startDate");
  }
  return { y, m, d };
}

/** Add whole days in UTC calendar (MVP; avoids library dependency). */
export function addDaysToIsoDate(isoDate: string, days: number): string {
  const { y, m, d } = parseStartDate(isoDate);
  const startUtc = Date.UTC(y, m - 1, d);
  const endMs = startUtc + Math.round(days) * 86_400_000;
  const end = new Date(endMs);
  const yy = end.getUTCFullYear();
  const mm = String(end.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(end.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Group financial preview — same formulas as {@link summarizeCycle} settlement (fixed MVP rules).
 */
export function computeGroupFinancePreview(
  input: GroupFinancePreviewInput,
): ComputeGroupFinancePreviewResult {
  const {
    contributionAmount,
    groupSize,
    daysPerCycle: daysPerCycleRaw,
    startDate,
    platformSettings: platformSettingsInput,
    payoutMode: payoutModeRaw,
  } = input;

  const payoutMode: PayoutMode =
    payoutModeRaw === "DAILY" ? PayoutMode.DAILY : PayoutMode.CYCLE;

  let cycleCalendarDays: number;
  let grossDayMultiplier: number;

  if (payoutMode === PayoutMode.DAILY) {
    cycleCalendarDays = 1;
    grossDayMultiplier = 1;
  } else {
    const days =
      daysPerCycleRaw === undefined || daysPerCycleRaw === null
        ? NaN
        : daysPerCycleRaw;
    if (Number.isNaN(days) || !Number.isInteger(days)) {
      return {
        ok: false,
        reason: "Days per cycle is required for multi-day (CYCLE) payout mode",
      };
    }
    if (days < 1 || days > 366) {
      return {
        ok: false,
        reason: "Days per cycle must be between 1 and 366",
      };
    }
    cycleCalendarDays = days;
    grossDayMultiplier = days;
  }

  if (
    contributionAmount === undefined ||
    contributionAmount === null ||
    Number.isNaN(contributionAmount)
  ) {
    return { ok: false, reason: "Contribution amount is required" };
  }
  if (contributionAmount <= 0) {
    return { ok: false, reason: "Contribution amount must be greater than 0" };
  }
  if (
    groupSize === undefined ||
    groupSize === null ||
    Number.isNaN(groupSize) ||
    !Number.isInteger(groupSize)
  ) {
    return { ok: false, reason: "Group size must be a whole number" };
  }
  if (groupSize < 5 || groupSize > 250) {
    return { ok: false, reason: "Group size must be between 5 and 250" };
  }
  if (!startDate || typeof startDate !== "string") {
    return { ok: false, reason: "Start date is required" };
  }

  let platform: GroupFinancePlatformSettings;
  try {
    platform = resolveGroupFinancePlatformSettings(
      platformSettingsInput && typeof platformSettingsInput === "object"
        ? platformSettingsInput
        : undefined,
    );
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Invalid platform settings",
    };
  }

  let endDate: string;
  try {
    parseStartDate(startDate);
    const totalDurationDays = groupSize * cycleCalendarDays;
    endDate = addDaysToIsoDate(startDate, totalDurationDays);
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : "Invalid start date",
    };
  }

  const payoutSchedule: PayoutScheduleRow[] = [];
  for (let i = 1; i <= groupSize; i++) {
    payoutSchedule.push({
      cycle: i,
      payoutDate: addDaysToIsoDate(startDate, i * cycleCalendarDays),
    });
  }

  const totalCollectedPerCycle = roundCurrency2(
    contributionAmount * groupSize * grossDayMultiplier,
  );
  const serviceMarginPerCycle = roundCurrency2(
    (totalCollectedPerCycle * platform.serviceMarginPercentage) / 100,
  );
  const payoutAmountPerCycle = roundCurrency2(
    totalCollectedPerCycle - serviceMarginPerCycle,
  );
  const adminEarningPerCycle = roundCurrency2(
    (serviceMarginPerCycle * platform.adminSplitPercentage) / 100,
  );
  const myTurnEarningPerCycle = roundCurrency2(
    (serviceMarginPerCycle * platform.myTurnSplitPercentage) / 100,
  );

  const totalCycles = groupSize;
  const totalAdminEarnings = roundCurrency2(
    adminEarningPerCycle * totalCycles,
  );
  const totalMyTurnEarnings = roundCurrency2(
    myTurnEarningPerCycle * totalCycles,
  );

  const serviceMarginBps = Math.round(platform.serviceMarginPercentage * 100);

  return {
    ok: true,
    preview: {
      payoutMode,
      daysPerCycle: cycleCalendarDays,
      totalCollectedPerCycle,
      serviceMarginPerCycle,
      payoutAmountPerCycle,
      adminEarningPerCycle,
      myTurnEarningPerCycle,
      totalCycles,
      totalAdminEarnings,
      totalMyTurnEarnings,
      endDate,
      payoutSchedule,
      serviceMarginBps,
    },
  };
}

/** GHS display with grouping (e.g. 1,234.56). */
export function formatGhs(amount: number): string {
  if (!Number.isFinite(amount)) return "—";
  return (
    "GHS " +
    new Intl.NumberFormat("en-GH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  );
}

/**
 * Map schedule to legacy DB enum (arbitrary schedules → MONTHLY).
 * @deprecated New groups no longer use interval scheduling in the product API.
 */
export function mapScheduleToLegacyContributionFrequency(
  frequencyUnit: FrequencyUnit,
  frequencyValue: number,
): "WEEKLY" | "BIWEEKLY" | "MONTHLY" {
  if (frequencyUnit === "week" && frequencyValue === 1) return "WEEKLY";
  if (frequencyUnit === "week" && frequencyValue === 2) return "BIWEEKLY";
  if (frequencyUnit === "month" && frequencyValue === 1) return "MONTHLY";
  return "MONTHLY";
}
