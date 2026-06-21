"use client";

import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import { BookOpen, ScrollText, X } from "lucide-react";
import { formatGhs } from "@myturn/shared";
import type {
  LedgerAccountSummary,
  LedgerAccountsResponse,
  LedgerLineSummary,
  LedgerTransactionDetailResponse,
  LedgerTransactionSummary,
  LedgerTransactionsResponse,
} from "@myturn/api-client";
import { DataTable } from "@/components/dashboard/DataTable";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  AccountTypeCell,
  GroupCell,
  OwnerCell,
} from "@/components/hq/ledger-explorer-cells";
import { getMyturnApi } from "@/lib/myturn-api";
import {
  ACCOUNT_TYPE_HELP,
  ACCOUNT_TYPE_LABELS,
  LEDGER_ACCOUNT_TYPES,
} from "@/lib/ledger-labels";
import { LIVE_POLL_MS } from "@/lib/swr";

const REFERENCE_TYPES = [
  "Payment",
  "Payout",
  "WithdrawalRequest",
  "ContributionGuaranteeReserve",
  "Deposit",
  "DepositForfeit",
  "DepositRelease",
  "DefaultCoverage",
] as const;

function money(s: string | undefined): string {
  if (!s) return "—";
  const n = Number(s);
  return Number.isNaN(n) ? s : formatGhs(n);
}

function buildAccountsKey(filters: Record<string, string>) {
  const q = new URLSearchParams(filters);
  return `/hq/ledger/accounts?${q.toString()}`;
}

function buildTransactionsKey(filters: Record<string, string>) {
  const q = new URLSearchParams(filters);
  return `/hq/ledger/transactions?${q.toString()}`;
}

export default function HqLedgerPage() {
  const [accountType, setAccountType] = useState("");
  const [referenceType, setReferenceType] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [showTechnicalIds, setShowTechnicalIds] = useState(false);

  const accountFilters = useMemo(() => {
    const f: Record<string, string> = { limit: "50" };
    if (accountType) f.accountType = accountType;
    if (search) f.search = search;
    if (ownerId) f.ownerId = ownerId;
    if (groupId) f.groupId = groupId;
    return f;
  }, [accountType, search, ownerId, groupId]);

  const transactionFilters = useMemo(() => {
    const f: Record<string, string> = { limit: "50" };
    if (referenceType) f.referenceType = referenceType;
    if (search) f.search = search;
    if (dateFrom) f.dateFrom = dateFrom;
    if (dateTo) f.dateTo = dateTo;
    if (accountType) f.accountType = accountType;
    if (ownerId) f.ownerId = ownerId;
    if (groupId) f.groupId = groupId;
    return f;
  }, [referenceType, search, dateFrom, dateTo, accountType, ownerId, groupId]);

  const accountsKey = buildAccountsKey(accountFilters);
  const transactionsKey = buildTransactionsKey(transactionFilters);

  const fetchAccounts = useCallback(async () => {
    return getMyturnApi().hqLedger.hqLedgerAccounts({
      accountType: accountFilters.accountType,
      search: accountFilters.search,
      ownerId: accountFilters.ownerId,
      groupId: accountFilters.groupId,
      limit: 50,
    });
  }, [accountFilters]);

  const fetchTransactions = useCallback(async () => {
    return getMyturnApi().hqLedger.hqLedgerTransactions({
      referenceType: transactionFilters.referenceType,
      search: transactionFilters.search,
      dateFrom: transactionFilters.dateFrom,
      dateTo: transactionFilters.dateTo,
      accountType: transactionFilters.accountType,
      ownerId: transactionFilters.ownerId,
      groupId: transactionFilters.groupId,
      limit: 50,
    });
  }, [transactionFilters]);

  const {
    data: accountsData,
    error: accountsError,
    isLoading: accountsLoading,
  } = useSWR<LedgerAccountsResponse>(accountsKey, fetchAccounts, {
    refreshInterval: LIVE_POLL_MS,
  });

  const {
    data: transactionsData,
    error: transactionsError,
    isLoading: transactionsLoading,
  } = useSWR<LedgerTransactionsResponse>(transactionsKey, fetchTransactions, {
    refreshInterval: LIVE_POLL_MS,
  });

  const { data: txDetail, isLoading: txDetailLoading } =
    useSWR<LedgerTransactionDetailResponse>(
      selectedTxId ? `ledger-tx-${selectedTxId}` : null,
      () => getMyturnApi().hqLedger.hqLedgerTransaction(selectedTxId!),
    );

  function clearFilters() {
    setAccountType("");
    setReferenceType("");
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setOwnerId("");
    setGroupId("");
  }

  const summary = accountsData?.summary;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <ScrollText className="mt-1 h-8 w-8 text-brand-green" />
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Ledger Explorer
            </h1>
            <p className="text-sm text-gray-600">
              The Ledger Explorer is read-only. It shows how money moves across
              MyTurn accounts.
            </p>
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-card">
          <input
            type="checkbox"
            checked={showTechnicalIds}
            onChange={(e) => setShowTechnicalIds(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-gray-700">Show technical IDs</span>
        </label>
      </div>

      {(accountsError || transactionsError) && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {accountsError instanceof Error
            ? accountsError.message
            : transactionsError instanceof Error
              ? transactionsError.message
              : "Failed to load ledger explorer data"}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={BookOpen}
          label="Total accounts"
          value={accountsLoading ? "—" : String(summary?.totalAccounts ?? 0)}
          loading={accountsLoading}
        />
        <StatCard
          icon={BookOpen}
          label="Non-zero accounts"
          value={accountsLoading ? "—" : String(summary?.nonZeroAccounts ?? 0)}
          loading={accountsLoading}
        />
        <StatCard
          icon={BookOpen}
          label="Temporary holding"
          value={accountsLoading ? "—" : money(summary?.platformFloatGhs)}
          loading={accountsLoading}
        />
        <StatCard
          icon={BookOpen}
          label="Group contribution pool"
          value={accountsLoading ? "—" : money(summary?.groupPoolTotalGhs)}
          loading={accountsLoading}
        />
        <StatCard
          icon={BookOpen}
          label="Member withdrawable"
          value={
            accountsLoading ? "—" : money(summary?.memberAvailableTotalGhs)
          }
          loading={accountsLoading}
        />
        <StatCard
          icon={BookOpen}
          label="Member reserved"
          value={
            accountsLoading ? "—" : money(summary?.memberReservedTotalGhs)
          }
          loading={accountsLoading}
        />
        <StatCard
          icon={BookOpen}
          label="Deposit escrow"
          value={accountsLoading ? "—" : money(summary?.depositEscrowTotalGhs)}
          loading={accountsLoading}
        />
        <StatCard
          icon={BookOpen}
          label="MyTurn revenue"
          value={accountsLoading ? "—" : money(summary?.myturnRevenueGhs)}
          loading={accountsLoading}
        />
        <StatCard
          icon={BookOpen}
          label="Pending withdrawals"
          value={
            accountsLoading ? "—" : money(summary?.withdrawalClearingGhs)
          }
          loading={accountsLoading}
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-card">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <FilterField label="Account type">
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All account types</option>
              {LEDGER_ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ACCOUNT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Reference type">
            <select
              value={referenceType}
              onChange={(e) => setReferenceType(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All references</option>
              {REFERENCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Date from">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </FilterField>
          <FilterField label="Date to">
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </FilterField>
          <FilterField label="Search" className="min-w-[220px] flex-1">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search member, admin, group, phone, reference…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </FilterField>
          {showTechnicalIds ? (
            <>
              <FilterField label="Owner ID">
                <input
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm"
                />
              </FilterField>
              <FilterField label="Group ID">
                <input
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm"
                />
              </FilterField>
            </>
          ) : null}
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Clear filters
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LEDGER_ACCOUNT_TYPES.map((type) => (
            <div key={type} className="text-xs text-gray-600">
              <p className="font-semibold text-gray-800">
                {ACCOUNT_TYPE_LABELS[type]}
              </p>
              <p>{ACCOUNT_TYPE_HELP[type]}</p>
            </div>
          ))}
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Accounts</h2>
        {accountsLoading ? (
          <LoadingRows />
        ) : (
          <DataTable<LedgerAccountSummary>
            rows={accountsData?.accounts ?? []}
            rowKey={(r) => r.id}
            emptyMessage="No ledger accounts match these filters."
            columns={[
              {
                key: "type",
                header: "Account type",
                render: (r) => <AccountTypeCell accountType={r.accountType} />,
              },
              {
                key: "owner",
                header: "Owner / member",
                render: (r) => (
                  <OwnerCell
                    owner={r.owner}
                    ownerId={r.ownerId}
                    showTechnical={showTechnicalIds}
                  />
                ),
              },
              {
                key: "group",
                header: "Group",
                render: (r) => (
                  <GroupCell
                    group={r.group}
                    groupId={r.groupId}
                    showTechnical={showTechnicalIds}
                  />
                ),
              },
              {
                key: "balance",
                header: "Balance",
                render: (r) => (
                  <span className="font-semibold">GHS {r.balanceGhs}</span>
                ),
              },
              {
                key: "currency",
                header: "Currency",
                render: (r) => r.currency,
              },
              {
                key: "updated",
                header: "Updated",
                render: (r) => new Date(r.updatedAt).toLocaleString("en-GH"),
              },
            ]}
          />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Transactions</h2>
        {transactionsLoading ? (
          <LoadingRows />
        ) : (
          <DataTable<LedgerTransactionSummary>
            rows={transactionsData?.transactions ?? []}
            rowKey={(r) => r.id}
            emptyMessage="No ledger transactions match these filters."
            columns={[
              {
                key: "date",
                header: "Date",
                render: (r) => new Date(r.createdAt).toLocaleString("en-GH"),
              },
              {
                key: "description",
                header: "Description",
                render: (r) => r.description ?? "—",
              },
              {
                key: "refType",
                header: "Reference type",
                render: (r) => r.referenceType,
              },
              {
                key: "refId",
                header: "Reference ID",
                render: (r) =>
                  showTechnicalIds ? (
                    <span className="font-mono text-xs">{r.referenceId}</span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  ),
              },
              {
                key: "lines",
                header: "Lines",
                render: (r) => r.lineCount,
              },
              {
                key: "movement",
                header: "Movement",
                render: (r) => `GHS ${r.totalMovementGhs}`,
              },
              {
                key: "view",
                header: "",
                render: (r) => (
                  <button
                    type="button"
                    onClick={() => setSelectedTxId(r.id)}
                    className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold hover:bg-gray-50"
                  >
                    View
                  </button>
                ),
              },
            ]}
          />
        )}
      </section>

      {selectedTxId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Transaction detail
                </h3>
                {showTechnicalIds ? (
                  <p className="font-mono text-xs text-gray-500">
                    {selectedTxId}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setSelectedTxId(null)}
                className="rounded-lg border border-gray-300 p-2 hover:bg-gray-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {txDetailLoading || !txDetail ? (
              <LoadingRows />
            ) : (
              <div className="space-y-4">
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <DetailItem
                    label="Description"
                    value={txDetail.transaction.description ?? "—"}
                  />
                  <DetailItem
                    label="Reference type"
                    value={txDetail.transaction.referenceType}
                  />
                  {showTechnicalIds ? (
                    <>
                      <DetailItem
                        label="Reference ID"
                        value={txDetail.transaction.referenceId}
                      />
                      <DetailItem
                        label="Transaction ID"
                        value={txDetail.transaction.id}
                      />
                      <DetailItem
                        label="Idempotency key"
                        value={txDetail.transaction.idempotencyKey}
                      />
                    </>
                  ) : null}
                  <DetailItem
                    label="Created"
                    value={new Date(
                      txDetail.transaction.createdAt,
                    ).toLocaleString("en-GH")}
                  />
                </dl>

                <div>
                  <h4 className="mb-2 text-sm font-semibold text-gray-800">
                    Metadata
                  </h4>
                  <pre className="overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-800">
                    {JSON.stringify(txDetail.transaction.metadata, null, 2)}
                  </pre>
                </div>

                {Object.keys(txDetail.related).length > 0 ? (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold text-gray-800">
                      Related
                    </h4>
                    <pre className="overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-800">
                      {JSON.stringify(txDetail.related, null, 2)}
                    </pre>
                  </div>
                ) : null}

                <div>
                  <h4 className="mb-2 text-sm font-semibold text-gray-800">
                    Ledger lines
                  </h4>
                  <DataTable<LedgerLineSummary>
                    rows={txDetail.lines}
                    rowKey={(r) => r.id}
                    columns={[
                      {
                        key: "accountType",
                        header: "Account",
                        render: (r) => (
                          <AccountTypeCell accountType={r.accountType} />
                        ),
                      },
                      {
                        key: "owner",
                        header: "Owner",
                        render: (r) => (
                          <OwnerCell
                            owner={r.owner}
                            ownerId={r.ownerId}
                            showTechnical={showTechnicalIds}
                          />
                        ),
                      },
                      {
                        key: "group",
                        header: "Group",
                        render: (r) => (
                          <GroupCell
                            group={r.group}
                            groupId={r.groupId}
                            showTechnical={showTechnicalIds}
                          />
                        ),
                      },
                      {
                        key: "amount",
                        header: "Amount",
                        render: (r) => (
                          <span className="font-semibold">
                            {r.direction === "DEBIT" ? "−" : "+"}GHS{" "}
                            {r.amountGhs}
                          </span>
                        ),
                      },
                      {
                        key: "balanceAfter",
                        header: "Balance after",
                        render: (r) => `GHS ${r.balanceAfterGhs}`,
                      },
                    ]}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={className ?? "min-w-[160px]"}>
      <span className="mb-1 block text-xs font-medium text-gray-600">
        {label}
      </span>
      {children}
    </label>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="break-all text-sm text-gray-900">{value}</dd>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-200/80" />
      ))}
    </div>
  );
}
