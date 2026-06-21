import type { ApiClient } from "./client";

export type LedgerExplorerOwnerSummary = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: string;
};

export type LedgerExplorerGroupSummary = {
  id: string;
  name: string;
  inviteCode: string;
};

export type LedgerAccountSummary = {
  id: string;
  accountKey: string;
  accountType: string;
  currency: string;
  ownerId: string | null;
  groupId: string | null;
  balanceMinor: string;
  balanceGhs: string;
  createdAt: string;
  updatedAt: string;
  owner: LedgerExplorerOwnerSummary | null;
  group: LedgerExplorerGroupSummary | null;
};

export type LedgerLineSummary = {
  id: string;
  accountId: string;
  accountType: string;
  ownerId: string | null;
  groupId: string | null;
  currency?: string;
  direction: "CREDIT" | "DEBIT";
  amountMinor: string;
  amountGhs: string;
  signedAmountGhs?: string;
  balanceAfterMinor: string;
  balanceAfterGhs: string;
  owner?: LedgerExplorerOwnerSummary | null;
  group?: LedgerExplorerGroupSummary | null;
};

export type LedgerTransactionSummary = {
  id: string;
  referenceType: string;
  referenceId: string;
  description: string | null;
  idempotencyKey: string;
  metadata: unknown;
  createdAt: string;
  lineCount: number;
  totalMovementGhs: string;
  lines: LedgerLineSummary[];
};

export type LedgerAccountsSummary = {
  totalAccounts: number;
  nonZeroAccounts: number;
  platformFloatGhs: string;
  groupPoolTotalGhs: string;
  memberAvailableTotalGhs: string;
  memberReservedTotalGhs: string;
  depositEscrowTotalGhs: string;
  myturnRevenueGhs: string;
  withdrawalClearingGhs: string;
  systemExternalGhs: string;
};

export type LedgerAccountsResponse = {
  summary: LedgerAccountsSummary;
  accounts: LedgerAccountSummary[];
  nextCursor: string | null;
};

export type LedgerTransactionsResponse = {
  transactions: LedgerTransactionSummary[];
  nextCursor: string | null;
};

export type LedgerTransactionDetailResponse = {
  transaction: Omit<LedgerTransactionSummary, "lineCount" | "totalMovementGhs" | "lines">;
  lines: LedgerLineSummary[];
  related: Record<string, unknown>;
};

export type LedgerExplorerAccountFilters = {
  accountType?: string;
  ownerId?: string;
  groupId?: string;
  search?: string;
  minBalance?: string;
  maxBalance?: string;
  limit?: number;
  cursor?: string;
};

export type LedgerExplorerTransactionFilters = {
  dateFrom?: string;
  dateTo?: string;
  referenceType?: string;
  referenceId?: string;
  accountType?: string;
  ownerId?: string;
  groupId?: string;
  search?: string;
  limit?: number;
  cursor?: string;
};

/** Combined filter shape for ledger explorer UIs. */
export type LedgerExplorerFilters = LedgerExplorerAccountFilters &
  LedgerExplorerTransactionFilters;

function toQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    q.set(key, String(value));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function createHqLedgerApi(client: ApiClient) {
  return {
    hqLedgerAccounts(filters: LedgerExplorerAccountFilters = {}) {
      return client.get<LedgerAccountsResponse>(
        `/hq/ledger/accounts${toQuery({
          accountType: filters.accountType,
          ownerId: filters.ownerId,
          groupId: filters.groupId,
          search: filters.search,
          minBalance: filters.minBalance,
          maxBalance: filters.maxBalance,
          limit: filters.limit,
          cursor: filters.cursor,
        })}`,
        false,
      );
    },
    hqLedgerTransactions(filters: LedgerExplorerTransactionFilters = {}) {
      return client.get<LedgerTransactionsResponse>(
        `/hq/ledger/transactions${toQuery({
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          referenceType: filters.referenceType,
          referenceId: filters.referenceId,
          accountType: filters.accountType,
          ownerId: filters.ownerId,
          groupId: filters.groupId,
          search: filters.search,
          limit: filters.limit,
          cursor: filters.cursor,
        })}`,
        false,
      );
    },
    hqLedgerTransaction(id: string) {
      return client.get<LedgerTransactionDetailResponse>(
        `/hq/ledger/transactions/${encodeURIComponent(id)}`,
        false,
      );
    },
  };
}
