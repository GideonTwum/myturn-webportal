import type { ApiClient } from "./client";

export type WalletSummary = {
  accountId: string;
  currency: string;
  balance: string;
  availableBalance: string;
  pendingWithdrawals: string;
  totalPayoutsCredited?: string;
  payoutsCreditedCount?: number;
  totalEarningsRecorded?: string;
  totalWithdrawn: string;
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
  platformFloatBalance: string;
  myturnRevenueBalance: string;
  totalMemberWalletLiabilities: string;
  totalAdminEarningsLiabilities: string;
  totalGroupPoolBalance: string;
  withdrawalClearingBalance: string;
  totalPendingWithdrawals: string;
  pendingWithdrawalsCount: number;
  totalCompletedWithdrawals: string;
  completedWithdrawalsCount: number;
};

export type ReconciliationSummary = {
  status: "ok" | "discrepancies_detected";
  totalCollected: string;
  totalAllocated: string;
  platformFloat: string;
  groupPoolTotal: string;
  memberWalletLiabilities: string;
  adminEarningsLiabilities: string;
  myturnRevenueBalance: string;
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
  adminEarningsRecorded: string;
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
    adminListWithdrawals(status?: string) {
      const q = status ? `?status=${encodeURIComponent(status)}` : "";
      return client.get<WithdrawalsListResponse>(`/admin/withdrawals${q}`, false);
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
  };
}
