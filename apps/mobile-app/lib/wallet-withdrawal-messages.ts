import { formatGhs } from "@/lib/format-money";

/** Educational copy when withdrawal exceeds available balance (reserve active). */
export function reserveExceedsAvailableMessage(
  available: number,
  reserved: number,
): string {
  return (
    `You can currently withdraw up to ${formatGhs(available)}.\n\n` +
    `${formatGhs(reserved)} is reserved as your Contribution Guarantee and unlocks automatically as you continue contributing.\n\n` +
    `This helps protect all members in your group and ensures everyone receives their payout.`
  );
}

function extractGhsLimit(raw: string, pattern: RegExp): string | null {
  const match = raw.match(pattern);
  return match?.[1]?.trim() ?? null;
}

/** Enhance API/limit errors with available balance context. */
export function enhanceWithdrawalErrorMessage(
  raw: string,
  available: number,
): string {
  const availableLabel = formatGhs(available);

  const maxSingle = extractGhsLimit(
    raw,
    /Maximum single withdrawal is GHS ([\d,.]+)/i,
  );
  if (maxSingle) {
    return (
      `Your available balance is ${availableLabel}, but this withdrawal exceeds ` +
      `the current platform/provider limit of GHS ${maxSingle}.`
    );
  }

  const maxDaily = extractGhsLimit(
    raw,
    /Daily withdrawal limit is GHS ([\d,.]+)/i,
  );
  if (maxDaily) {
    return (
      `Your available balance is ${availableLabel}, but this withdrawal exceeds ` +
      `the current platform/provider daily limit of GHS ${maxDaily}.`
    );
  }

  if (/daily withdrawal limit reached/i.test(raw)) {
    return `${raw.trim()} Your available balance is ${availableLabel}.`;
  }

  if (/insufficient available balance/i.test(raw) && !/contribution guarantee/i.test(raw)) {
    return `You can currently withdraw up to ${availableLabel}.`;
  }

  return raw;
}
