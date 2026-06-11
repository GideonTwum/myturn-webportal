import type { ContributionReserveConfig } from "@myturn/shared";

function parseBool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined || v === "") return fallback;
  return v === "true" || v === "1";
}

function parseIntEnv(v: string | undefined, fallback: number): number {
  if (v === undefined || v === "") return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Contribution Guarantee Reserve settings (env-backed). */
export function getContributionReserveConfig(): ContributionReserveConfig {
  return {
    enabled: parseBool(process.env.CONTRIBUTION_RESERVE_ENABLED, false),
    maxBps: parseIntEnv(process.env.CONTRIBUTION_RESERVE_MAX_BPS, 3000),
    minBps: parseIntEnv(process.env.CONTRIBUTION_RESERVE_MIN_BPS, 0),
    // CONTRIBUTION_RESERVE_MAX_AMOUNT is deprecated and no longer applied.
  };
}
