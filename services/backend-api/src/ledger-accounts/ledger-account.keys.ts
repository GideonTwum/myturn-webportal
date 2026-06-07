import { LedgerAccountType } from "@prisma/client";

export const DEFAULT_CURRENCY = "GHS";

export function platformFloatKey(currency = DEFAULT_CURRENCY): string {
  return `PLATFORM_FLOAT:${currency}`;
}

export function myturnRevenueKey(currency = DEFAULT_CURRENCY): string {
  return `MYTURN_REVENUE:${currency}`;
}

export function withdrawalClearingKey(currency = DEFAULT_CURRENCY): string {
  return `WITHDRAWAL_CLEARING:${currency}`;
}

export function systemExternalKey(currency = DEFAULT_CURRENCY): string {
  return `SYSTEM_EXTERNAL:${currency}`;
}

export function groupPoolKey(groupId: string, currency = DEFAULT_CURRENCY): string {
  return `GROUP_POOL:${groupId}:${currency}`;
}

export function memberWalletKey(userId: string, currency = DEFAULT_CURRENCY): string {
  return `MEMBER_WALLET:${userId}:${currency}`;
}

export function adminEarningsKey(userId: string, currency = DEFAULT_CURRENCY): string {
  return `ADMIN_EARNINGS:${userId}:${currency}`;
}

export function accountTypeForKey(key: string): LedgerAccountType | null {
  if (key.startsWith("PLATFORM_FLOAT:")) return LedgerAccountType.PLATFORM_FLOAT;
  if (key.startsWith("MYTURN_REVENUE:")) return LedgerAccountType.MYTURN_REVENUE;
  if (key.startsWith("WITHDRAWAL_CLEARING:")) return LedgerAccountType.WITHDRAWAL_CLEARING;
  if (key.startsWith("SYSTEM_EXTERNAL:")) return LedgerAccountType.SYSTEM_EXTERNAL;
  if (key.startsWith("GROUP_POOL:")) return LedgerAccountType.GROUP_POOL;
  if (key.startsWith("MEMBER_WALLET:")) return LedgerAccountType.MEMBER_WALLET;
  if (key.startsWith("ADMIN_EARNINGS:")) return LedgerAccountType.ADMIN_EARNINGS;
  return null;
}
