import type {
  LedgerExplorerGroupSummary,
  LedgerExplorerOwnerSummary,
} from "@myturn/api-client";

export const LEDGER_ACCOUNT_TYPES = [
  "MEMBER_WALLET_AVAILABLE",
  "MEMBER_WALLET_RESERVED",
  "MEMBER_DEPOSIT_ESCROW",
  "GROUP_POOL",
  "MYTURN_REVENUE",
  "WITHDRAWAL_CLEARING",
  "SYSTEM_EXTERNAL",
  "PLATFORM_FLOAT",
] as const;

export type LedgerAccountTypeCode = (typeof LEDGER_ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  MEMBER_WALLET_AVAILABLE: "Member Withdrawable Balance",
  MEMBER_WALLET_RESERVED: "Member Reserved Balance",
  MEMBER_DEPOSIT_ESCROW: "Member Deposit Escrow",
  GROUP_POOL: "Group Contribution Pool",
  MYTURN_REVENUE: "MyTurn Revenue",
  WITHDRAWAL_CLEARING: "Pending Withdrawals",
  SYSTEM_EXTERNAL: "Outside Money Movement",
  PLATFORM_FLOAT: "Temporary Holding Account",
};

export const ACCOUNT_TYPE_HELP: Record<string, string> = {
  MEMBER_WALLET_AVAILABLE: "Money a member can withdraw now.",
  MEMBER_WALLET_RESERVED: "Money temporarily reserved to protect the group.",
  MEMBER_DEPOSIT_ESCROW:
    "Security deposits held until release or forfeiture.",
  GROUP_POOL: "Contributions collected for a group before payout.",
  MYTURN_REVENUE: "Service margin earned by MyTurn.",
  WITHDRAWAL_CLEARING: "Money being processed for MoMo withdrawal.",
  SYSTEM_EXTERNAL: "Money entering or leaving MyTurn.",
  PLATFORM_FLOAT:
    "Temporary account used while moving money between systems.",
};

export function friendlyAccountLabel(accountType: string): string {
  return ACCOUNT_TYPE_LABELS[accountType] ?? accountType;
}

export function ownerDisplayName(
  owner: LedgerExplorerOwnerSummary | null | undefined,
): string | null {
  if (!owner) return null;
  const name = [owner.firstName, owner.lastName].filter(Boolean).join(" ");
  return name || null;
}

export function ownerRoleLabel(
  owner: LedgerExplorerOwnerSummary | null | undefined,
): string | null {
  if (!owner?.role) return null;
  if (owner.role === "SUPER_ADMIN") return "HQ";
  if (owner.role === "ADMIN") return "Admin";
  if (owner.role === "USER") return "Member";
  return owner.role;
}

export function ownerContact(
  owner: LedgerExplorerOwnerSummary | null | undefined,
): string | null {
  if (!owner) return null;
  return owner.phone?.trim() || owner.email || null;
}

export function groupInviteCode(
  group: LedgerExplorerGroupSummary | null | undefined,
): string | null {
  return group?.inviteCode?.trim() || null;
}
