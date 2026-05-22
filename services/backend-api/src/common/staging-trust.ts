/**
 * When true, member trust gates (Ghana Card, join, contributions) are relaxed for testing.
 * Set STAGING_RELAX_TRUST=true on Railway staging; defaults on when NODE_ENV !== production.
 */
export function isStagingRelaxTrust(): boolean {
  const flag = process.env.STAGING_RELAX_TRUST?.trim().toLowerCase();
  if (flag === "true" || flag === "1" || flag === "yes") return true;
  if (flag === "false" || flag === "0" || flag === "no") return false;
  return process.env.NODE_ENV !== "production";
}
