"use client";

import useSWR from "swr";
import Link from "next/link";
import { Scale, Wallet } from "lucide-react";
import { formatGhs } from "@myturn/shared";
import { swrFetcher, LIVE_POLL_MS } from "@/lib/swr";
import { StatCard } from "@/components/dashboard/StatCard";
import type { HqWalletsSummary } from "@myturn/api-client";

function money(s: string | undefined): string {
  if (!s) return "—";
  const n = Number(s);
  return Number.isNaN(n) ? s : formatGhs(n);
}

export default function HqWalletsPage() {
  const { data, error, isLoading } = useSWR<HqWalletsSummary>(
    "/hq/wallets/summary",
    swrFetcher,
    { refreshInterval: LIVE_POLL_MS },
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start gap-3">
        <Wallet className="mt-1 h-8 w-8 text-brand-green" />
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Platform wallets</h1>
          <p className="text-sm text-gray-600">
            Ledger-derived balances. Read-only — no manual edits.{" "}
            <Link href="/hq/reconciliation" className="text-brand-green font-medium">
              View reconciliation
            </Link>
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error instanceof Error ? error.message : "Failed to load wallet summary"}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={Scale}
          label="Platform float"
          value={isLoading ? "—" : money(data?.platformFloatBalance)}
          loading={isLoading}
        />
        <StatCard
          icon={Scale}
          label="MyTurn revenue wallet"
          value={isLoading ? "—" : money(data?.myturnRevenueBalance)}
          loading={isLoading}
          iconClassName="text-blue-700"
        />
        <StatCard
          icon={Scale}
          label="Group pools (total)"
          value={isLoading ? "—" : money(data?.totalGroupPoolBalance)}
          loading={isLoading}
        />
        <StatCard
          icon={Scale}
          label="Member wallet (available)"
          value={isLoading ? "—" : money(data?.totalMemberWalletAvailable)}
          loading={isLoading}
        />
        <StatCard
          icon={Scale}
          label="Contribution Guarantee Reserve"
          value={isLoading ? "—" : money(data?.totalMemberWalletReserved)}
          loading={isLoading}
        />
        <StatCard
          icon={Scale}
          label="Member wallet liabilities (total)"
          value={isLoading ? "—" : money(data?.totalMemberWalletLiabilities)}
          loading={isLoading}
        />
        <StatCard
          icon={Scale}
          label="Legacy admin earnings liabilities"
          value={
            isLoading
              ? "—"
              : money(
                  data?.legacyAdminEarningsLiabilities ??
                    data?.totalAdminEarningsLiabilities,
                )
          }
          loading={isLoading}
        />
        <StatCard
          icon={Scale}
          label="Withdrawal clearing"
          value={isLoading ? "—" : money(data?.withdrawalClearingBalance)}
          loading={isLoading}
        />
        <StatCard
          icon={Scale}
          label="Pending withdrawals"
          value={
            isLoading
              ? "—"
              : `${money(data?.totalPendingWithdrawals)} (${data?.pendingWithdrawalsCount ?? 0})`
          }
          loading={isLoading}
        />
        <StatCard
          icon={Scale}
          label="Completed withdrawals"
          value={
            isLoading
              ? "—"
              : `${money(data?.totalCompletedWithdrawals)} (${data?.completedWithdrawalsCount ?? 0})`
          }
          loading={isLoading}
        />
      </div>

      {data?.contributionGuaranteeReserves ? (
        <div className="rounded-xl border bg-white p-4 text-sm text-gray-700">
          <h2 className="font-semibold text-gray-900">Contribution Guarantee Reserve</h2>
          <p className="mt-1">
            Active reserves: {data.contributionGuaranteeReserves.activeReserveCount} ·
            Reserved liabilities:{" "}
            {money(data.contributionGuaranteeReserves.totalReservedLiabilities)} ·
            Released to date:{" "}
            {money(data.contributionGuaranteeReserves.totalReleasedAmount)}
          </p>
        </div>
      ) : null}

      <div className="rounded-xl border bg-white p-4 text-sm text-gray-600">
        <p>
          Member withdrawals are automatic via MTN disbursement. Contribution
          Guarantee Reserve unlocks automatically as members make successful
          contributions after payout. Admin earnings are deprecated.
          HQ monitors{" "}
          <a href="/hq/withdrawals" className="font-medium text-brand-green">
            withdrawal status
          </a>{" "}
          and platform balances here.
        </p>
      </div>
    </div>
  );
}
