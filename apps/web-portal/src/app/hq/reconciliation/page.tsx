"use client";

import useSWR from "swr";
import { AlertTriangle, CheckCircle2, Scale } from "lucide-react";
import { formatGhs } from "@myturn/shared";
import { swrFetcher, LIVE_POLL_MS } from "@/lib/swr";
import { StatCard } from "@/components/dashboard/StatCard";
import type { ReconciliationSummary } from "@myturn/api-client";

function money(s: string | undefined): string {
  if (!s) return "—";
  const n = Number(s);
  if (Number.isNaN(n)) return s;
  return formatGhs(n);
}

export default function HqReconciliationPage() {
  const { data, error, isLoading } = useSWR<ReconciliationSummary>(
    "/hq/reconciliation/summary",
    swrFetcher,
    { refreshInterval: LIVE_POLL_MS },
  );

  const ok = data?.status === "ok";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start gap-3">
        <Scale className="mt-1 h-8 w-8 text-brand-green" />
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Ledger reconciliation</h1>
          <p className="text-sm text-gray-600">
            Read-only audit view. Balances are derived from the ledger — HQ cannot edit them.
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error instanceof Error ? error.message : "Failed to load reconciliation summary"}
        </p>
      ) : null}

      {data?.discrepancies?.length ? null : (
        <p className="text-xs text-gray-500">
          Daily snapshots stored for audit. Latest job status appears in API health under{" "}
          <code className="rounded bg-gray-100 px-1">infrastructure.reconciliation</code>.
        </p>
      )}

      <div
        className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
          ok
            ? "border-green-200 bg-green-50 text-green-800"
            : "border-amber-200 bg-amber-50 text-amber-900"
        }`}
      >
        {ok ? (
          <CheckCircle2 className="h-5 w-5 shrink-0" />
        ) : (
          <AlertTriangle className="h-5 w-5 shrink-0" />
        )}
        <span>
          Status:{" "}
          <strong>{isLoading ? "Loading…" : ok ? "OK" : "Discrepancies detected"}</strong>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Scale}
          label="Total collected (payments)"
          value={isLoading ? "—" : money(data?.totalCollected)}
          loading={isLoading}
        />
        <StatCard
          icon={Scale}
          label="Total allocated (approx.)"
          value={isLoading ? "—" : money(data?.totalAllocated)}
          loading={isLoading}
        />
        <StatCard
          icon={Scale}
          label="Platform float"
          value={isLoading ? "—" : money(data?.platformFloat)}
          loading={isLoading}
        />
        <StatCard
          icon={Scale}
          label="Total wallet liabilities"
          value={isLoading ? "—" : money(data?.totalWalletLiabilities)}
          loading={isLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={Scale}
          label="Group pools"
          value={isLoading ? "—" : money(data?.groupPoolTotal)}
          loading={isLoading}
        />
        <StatCard
          icon={Scale}
          label="Member wallet liabilities"
          value={isLoading ? "—" : money(data?.memberWalletLiabilities)}
          loading={isLoading}
        />
        <StatCard
          icon={Scale}
          label="Admin earnings liabilities"
          value={isLoading ? "—" : money(data?.adminEarningsLiabilities)}
          loading={isLoading}
        />
        <StatCard
          icon={Scale}
          label="MyTurn revenue wallet"
          value={isLoading ? "—" : money(data?.myturnRevenueBalance)}
          loading={isLoading}
        />
        <StatCard
          icon={Scale}
          label="Withdrawal clearing"
          value={isLoading ? "—" : money(data?.withdrawalClearing)}
          loading={isLoading}
        />
        <StatCard
          icon={Scale}
          label="Withdrawals pending"
          value={
            isLoading
              ? "—"
              : `${money(data?.totalWithdrawalsPending)} (${data?.pendingWithdrawalsCount ?? 0})`
          }
          loading={isLoading}
        />
        <StatCard
          icon={Scale}
          label="Withdrawals completed"
          value={
            isLoading
              ? "—"
              : `${money(data?.totalWithdrawalsCompleted)} (${data?.completedWithdrawalsCount ?? 0})`
          }
          loading={isLoading}
        />
        <StatCard
          icon={Scale}
          label="Admin withdrawals processing"
          value={
            isLoading
              ? "—"
              : `${money(data?.adminWithdrawalsProcessing)} (${data?.adminWithdrawalsProcessingCount ?? 0})`
          }
          loading={isLoading}
        />
        <StatCard
          icon={Scale}
          label="Admin withdrawals completed"
          value={
            isLoading
              ? "—"
              : `${money(data?.adminWithdrawalsCompleted)} (${data?.adminWithdrawalsCompletedCount ?? 0})`
          }
          loading={isLoading}
        />
        <StatCard
          icon={Scale}
          label="Admin withdrawals failed"
          value={
            isLoading
              ? "—"
              : `${money(data?.adminWithdrawalsFailed)} (${data?.adminWithdrawalsFailedCount ?? 0})`
          }
          loading={isLoading}
        />
        <StatCard
          icon={Scale}
          label="Stale admin processing"
          value={isLoading ? "—" : String(data?.staleAdminProcessingCount ?? 0)}
          loading={isLoading}
        />
        <StatCard
          icon={Scale}
          label="Admin earnings recorded"
          value={isLoading ? "—" : money(data?.adminEarningsRecorded)}
          loading={isLoading}
        />
        <StatCard
          icon={Scale}
          label="Platform revenue recorded"
          value={isLoading ? "—" : money(data?.platformRevenueRecorded)}
          loading={isLoading}
        />
      </div>

      {data?.discrepancies?.length ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="font-semibold text-amber-950">Discrepancies</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {data.discrepancies.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-amber-800">
            Auto-fix is not enabled. Investigate ledger transactions before adjusting data.
          </p>
        </div>
      ) : null}
    </div>
  );
}
