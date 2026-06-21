/** Member standing values used for payout queue selection. */
export type PayoutQueueStanding = "ACTIVE" | "LATE" | "DEFAULTED";

export type PayoutQueueMember = {
  userId: string;
  turnOrder: number;
  effectivePayoutOrder: number;
  cycleStanding: PayoutQueueStanding;
};

export type PayoutRecipientSelection = {
  recipient: PayoutQueueMember | null;
  /** Defaulted members skipped while resolving recipient for this cycle. */
  skippedDefaulted: PayoutQueueMember[];
  /** Nominal turn-order recipient before skip logic (for audit). */
  nominalRecipient: PayoutQueueMember | null;
};

/**
 * Select payout recipient for a cycle using effective payout queue order.
 * Skips DEFAULTED members unless allowOverride is true.
 */
export function selectPayoutRecipient(
  members: PayoutQueueMember[],
  cycleNumber: number,
  options?: { allowOverride?: boolean },
): PayoutRecipientSelection {
  if (members.length === 0) {
    return { recipient: null, skippedDefaulted: [], nominalRecipient: null };
  }

  const sorted = [...members].sort(
    (a, b) => a.effectivePayoutOrder - b.effectivePayoutOrder,
  );
  const n = sorted.length;
  const baseIndex = (cycleNumber - 1) % n;
  const nominalRecipient = sorted[baseIndex] ?? null;

  if (options?.allowOverride && nominalRecipient) {
    return {
      recipient: nominalRecipient,
      skippedDefaulted: [],
      nominalRecipient,
    };
  }

  const skippedDefaulted: PayoutQueueMember[] = [];
  for (let i = 0; i < n; i++) {
    const idx = (baseIndex + i) % n;
    const m = sorted[idx]!;
    if (m.cycleStanding === "DEFAULTED") {
      skippedDefaulted.push(m);
      continue;
    }
    return { recipient: m, skippedDefaulted, nominalRecipient };
  }

  return { recipient: null, skippedDefaulted, nominalRecipient };
}

/** Outstanding contribution amount from paid-day progress. */
export function missedContributionMinor(
  amountMinor: bigint,
  expectedDayCount: number,
  paidDayCount: number,
): bigint {
  if (expectedDayCount < 1) return amountMinor;
  const unpaidDays = Math.max(0, expectedDayCount - paidDayCount);
  if (unpaidDays <= 0) return 0n;
  return (amountMinor * BigInt(unpaidDays)) / BigInt(expectedDayCount);
}
