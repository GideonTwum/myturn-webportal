import { PayoutMode } from "@prisma/client";

/** Member obligation length in a cycle: one lump payment (DAILY) vs N daily accruals (CYCLE). */
export function memberCyclePaymentDays(group: {
  payoutMode: PayoutMode;
  daysPerCycle: number;
}): number {
  return group.payoutMode === PayoutMode.DAILY ? 1 : group.daysPerCycle;
}
