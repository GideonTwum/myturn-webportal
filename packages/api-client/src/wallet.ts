import type { ApiClient } from "./client";

export type ReserveDetail = {
  groupId: string;
  groupName: string;
  payoutCycle: number;
  originalReserveAmount: string;
  remainingReserveAmount: string;
  releasedAmount: string;
  nextUnlockAmount: string;
  releasePerUnitAmount?: string;
  releaseProgressPercent: number;
  remainingContributionUnits: number;
  releasedUnits: number;
  /** @deprecated Use remainingContributionUnits */
  remainingContributionCount?: number;
};

import type { ReserveDefaultCoverPrompt } from "./types";

export type WalletSummary = {
  accountId: string;
  currency: string;
  balance: string;
  availableBalance: string;
  reservedBalance?: string;
  /** CYCLE security deposits held in escrow (not withdrawable). */
  depositEscrowBalance?: string;
  totalBalance?: string;
  pendingWithdrawals: string;
  nextReserveUnlockAmount?: string;
  activeReserveCount?: number;
  reserveProgress?: number;
  reserveDetails?: ReserveDetail[];
  totalPayoutsCredited?: string;
  payoutsCreditedCount?: number;
  totalEarningsRecorded?: string;
  totalWithdrawn: string;
  reserveDefaultCoverPrompt?: ReserveDefaultCoverPrompt | null;
};

export type WalletActivityResponse = {
  activity: Array<{
    id: string;
    delta: string;
    balanceAfter: string;
    referenceType: string;
    referenceId: string;
    description: string | null;
    createdAt: string;
  }>;
};

export type WithdrawalRow = {
  id: string;
  actorId?: string;
  actorRole?: string;
  actorName?: string;
  canManage?: boolean;
  canManualOverride?: boolean;
  isStale?: boolean;
  amount: string;
  status: string;
  momoNumber: string;
  provider: string | null;
  providerRef: string | null;
  requestedAt: string;
  processedAt: string | null;
  failureReason: string | null;
  processingMode?: "automatic" | "hq_manual";
  simulated?: boolean;
};

export type WithdrawalsListResponse = {
  withdrawals: WithdrawalRow[];
  disbursementMode?: string;
};

export type HqWalletsSummary = {
  marginModel?: string;
  platformFloatBalance: string;
  myturnRevenueBalance: string;
  totalMemberWalletAvailable?: string;
  totalMemberWalletReserved?: string;
  totalMemberWalletLiabilities: string;
  legacyAdminEarningsLiabilities: string;
  totalAdminEarningsLiabilities?: string;
  totalGroupPoolBalance: string;
  withdrawalClearingBalance: string;
  totalPendingWithdrawals: string;
  pendingWithdrawalsCount: number;
  totalCompletedWithdrawals: string;
  completedWithdrawalsCount: number;
  contributionGuaranteeReserves?: {
    totalReservedLiabilities: string;
    totalReleasedAmount: string;
    activeReserveCount: number;
    releasedReserveCount: number;
    reservesByGroup: Array<{
      groupId: string;
      groupName: string;
      activeCount: number;
      remainingReserveAmount: string;
    }>;
  };
};

export type HqFinancialOverview = {
  marginModel: string;
  totalServiceMarginGhs: string;
  totalMyTurnRevenueGhs: string;
  myturnRevenueWalletBalanceGhs: string;
  legacyAdminEarningsGhs: string;
  completedPayoutsCount: number;
  totalPaidToMembersGhs: string;
  platformSplits: {
    myTurnRevenuePercentage: number;
    serviceMarginPercentage: number;
    adminSharePercentage: number;
    myTurnSharePercentage: number;
  };
  /** @deprecated Use totalMyTurnRevenueGhs */
  totalMyTurnEarningsGhs?: string;
  /** @deprecated Legacy historical only */
  totalAdminEarningsGhs?: string;
};

export type ReconciliationSummary = {
  status: "ok" | "discrepancies_detected";
  totalCollected: string;
  totalAllocated: string;
  platformFloat: string;
  groupPoolTotal: string;
  memberWalletLiabilities: string;
  /** @deprecated Use legacyAdminEarningsLiabilities — excluded from active formula */
  adminEarningsLiabilities?: string;
  legacyAdminEarningsLiabilities: string;
  marginModel?: string;
  myturnRevenueBalance: string;
  memberWalletAvailable?: string;
  memberWalletReserved?: string;
  withdrawalClearing: string;
  totalWalletLiabilities: string;
  totalWithdrawalsPending: string;
  pendingWithdrawalsCount: number;
  totalWithdrawalsCompleted: string;
  completedWithdrawalsCount: number;
  memberWithdrawalsProcessing?: string;
  memberWithdrawalsProcessingCount?: number;
  memberWithdrawalsCompleted?: string;
  memberWithdrawalsCompletedCount?: number;
  memberWithdrawalsFailed?: string;
  memberWithdrawalsFailedCount?: number;
  staleMemberProcessingCount?: number;
  adminWithdrawalsProcessing?: string;
  adminWithdrawalsProcessingCount?: number;
  adminWithdrawalsCompleted?: string;
  adminWithdrawalsCompletedCount?: number;
  adminWithdrawalsFailed?: string;
  adminWithdrawalsFailedCount?: number;
  staleAdminProcessingCount?: number;
  failedWithdrawalsWithoutReleaseCount?: number;
  legacyAdminEarningsRecorded: string;
  /** @deprecated Use legacyAdminEarningsRecorded */
  adminEarningsRecorded?: string;
  platformRevenueRecorded: string;
  discrepancies: string[];
};

export function createWalletApi(client: ApiClient) {
  return {
    memberSummary() {
      return client.get<WalletSummary>("/member/wallet", true);
    },
    memberActivity() {
      return client.get<WalletActivityResponse>("/member/wallet/activity", true);
    },
    memberCreateWithdrawal(body: { amount: string; momoNumber: string }) {
      return client.post<unknown>("/member/withdrawals", body, true);
    },
    memberListWithdrawals() {
      return client.get<WithdrawalsListResponse>("/member/withdrawals", true);
    },
    adminSummary() {
      return client.get<WalletSummary>("/admin/wallet", false);
    },
    adminActivity() {
      return client.get<WalletActivityResponse>("/admin/wallet/activity", false);
    },
    adminCreateWithdrawal(body: { amount: string; momoNumber: string }) {
      return client.post<unknown>("/admin/withdrawals", body, false);
    },
    /** @deprecated Admin earnings withdrawals removed. */
    adminListWithdrawals(status?: string) {
      const q = status ? `?status=${encodeURIComponent(status)}` : "";
      return client.get<WithdrawalsListResponse>(`/admin/withdrawals${q}`, false);
    },
    adminListMemberWithdrawals(status?: string) {
      const q = status ? `?status=${encodeURIComponent(status)}` : "";
      return client.get<WithdrawalsListResponse>(
        `/admin/member-withdrawals${q}`,
        false,
      );
    },
    hqListWithdrawals(status?: string) {
      const q = status ? `?status=${encodeURIComponent(status)}` : "";
      return client.get<WithdrawalsListResponse>(`/hq/withdrawals${q}`, false);
    },
    hqConfirmWithdrawal(id: string, body: { providerRef: string; provider?: string }) {
      return client.request<unknown>(
        `/hq/withdrawals/${id}/confirm`,
        { method: "PATCH", body: JSON.stringify(body) },
        { unwrapEnvelope: false },
      );
    },
    hqFailWithdrawal(id: string, body: { reason: string }) {
      return client.request<unknown>(
        `/hq/withdrawals/${id}/fail`,
        { method: "PATCH", body: JSON.stringify(body) },
        { unwrapEnvelope: false },
      );
    },
    hqWalletsSummary() {
      return client.get<HqWalletsSummary>("/hq/wallets/summary", false);
    },
    hqReconciliationSummary() {
      return client.get<ReconciliationSummary>("/hq/reconciliation/summary", false);
    },
    hqFinancialOverview() {
      return client.get<HqFinancialOverview>("/hq/financial-overview", false);
    },
  };
}
