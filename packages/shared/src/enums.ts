/** Platform role values stored in DB / JWT */
export enum UserRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  USER = "USER",
}

/** Human labels for UI */
export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: "MyTurn HQ",
  [UserRole.ADMIN]: "Admin",
  [UserRole.USER]: "Member",
};

/** Admin onboarding request */
export enum AdminRequestStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export enum ContributionFrequency {
  WEEKLY = "WEEKLY",
  BIWEEKLY = "BIWEEKLY",
  MONTHLY = "MONTHLY",
}

/** How the group collects before each payout (stored on `Group` in the API). */
export enum PayoutMode {
  DAILY = "DAILY",
  CYCLE = "CYCLE",
}

/** Same values as {@link PayoutMode} / Prisma `PayoutMode` — use on API boundaries to avoid enum type clashes. */
export type PayoutModeLiteral = "DAILY" | "CYCLE";

export enum GroupStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export enum ContributionStatus {
  PENDING = "PENDING",
  PAID = "PAID",
  LATE = "LATE",
  WAIVED = "WAIVED",
}

export enum PaymentStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export enum PayoutStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export interface MoneyAmount {
  /** Integer minor units or decimal string from API — callers should agree; Prisma uses Decimal */
  amountMinor: bigint;
  currencyCode: string;
}

export interface CycleSummary {
  cycleNumber: number;
  grossPoolAmountMinor: bigint;
  serviceMarginMinor: bigint;
  netAfterMarginMinor: bigint;
  adminShareMinor: bigint;
  platformShareMinor: bigint;
}
