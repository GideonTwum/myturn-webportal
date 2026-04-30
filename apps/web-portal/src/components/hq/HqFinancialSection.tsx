"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  Coins,
  PiggyBank,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
} from "lucide-react";
import { formatGhs } from "@myturn/shared";
import { DataTable } from "@/components/dashboard/DataTable";
import { StatCard } from "@/components/dashboard/StatCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { cn } from "@/lib/cn";
import { LIVE_POLL_MS, useSWR, useSWRConfig } from "@/lib/swr";

type PlatformSplits = {
  adminSharePercentage: number;
  myTurnSharePercentage: number;
  serviceMarginPercentage: number;
};

type FinancialOverview = {
  totalServiceMarginGhs: string;
  totalMyTurnEarningsGhs: string;
  totalAdminEarningsGhs: string;
  completedPayoutsCount: number;
  totalPaidToMembersGhs: string;
  platformSplits: PlatformSplits;
};

type EarningsRow = {
  groupId: string;
  groupName: string;
  adminName: string;
  contributionAmountGhs: string;
  groupSize: number;
  totalCollectedPerCycleGhs: string;
  serviceMarginTotalGhs: string;
  adminShareTotalGhs: string;
  myTurnShareTotalGhs: string;
  completedCycles: number;
  totalAdminEarningsGhs: string;
  totalMyTurnEarningsGhs: string;
};

type PayoutRow = {
  payoutId: string;
  memberName: string;
  groupName: string;
  adminName: string;
  payoutPosition: number | null;
  cycleNumber: number;
  payoutAmountGhs: string;
  serviceMarginGhs: string;
  adminShareGhs: string;
  myTurnShareGhs: string;
  payoutDate: string;
  status: string;
};

type Paged<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

type GroupOpt = {
  id: string;
  name: string;
  admin: { id: string; email: string };
};

type UserOpt = { id: string; email: string; role: string };

const field =
  "rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-brand-green/15 focus:border-brand-green focus:ring-2";

function moneyLabel(s: string): string {
  if (s === "—") return "—";
  const n = Number(s);
  if (Number.isNaN(n)) return s;
  return formatGhs(n);
}

function toParams(o: Record<string, string | number | undefined>): string {
  const u = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => {
    if (v === undefined || v === "") return;
    u.set(k, String(v));
  });
  const q = u.toString();
  return q ? `?${q}` : "";
}

function errMsg(e: unknown): string | null {
  if (!e) return null;
  if (e instanceof Error) return e.message;
  return "Failed to load";
}

export function HqFinancialSection() {
  const { mutate } = useSWRConfig();
  const [search, setSearch] = useState("");
  const [groupId, setGroupId] = useState("");
  const [adminId, setAdminId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [payoutStatus, setPayoutStatus] = useState("");
  const [bdPage, setBdPage] = useState(1);
  const [pyPage, setPyPage] = useState(1);
  const pageSize = 10;

  const commonFilter = useMemo(
    () => ({
      search: search.trim() || undefined,
      groupId: groupId || undefined,
      adminId: adminId || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [search, groupId, adminId, dateFrom, dateTo],
  );

  const earningsUrl = `/hq/earnings${toParams({
    ...commonFilter,
    page: bdPage,
    pageSize,
  })}`;
  const payoutsUrl = `/hq/payouts${toParams({
    ...commonFilter,
    status: payoutStatus || undefined,
    page: pyPage,
    pageSize,
  })}`;

  const swrOpts = {
    refreshInterval: LIVE_POLL_MS,
    keepPreviousData: true,
  } as const;

  const {
    data: overview,
    error: overviewErr,
    isLoading: loadingOv,
    isValidating: vOv,
  } = useSWR<FinancialOverview>("/hq/financial-overview", swrOpts);

  const {
    data: breakdown,
    error: bdErr,
    isLoading: loadingBd,
    isValidating: vBd,
  } = useSWR<Paged<EarningsRow>>(earningsUrl, swrOpts);

  const {
    data: payouts,
    error: pyErr,
    isLoading: loadingPy,
    isValidating: vPy,
  } = useSWR<Paged<PayoutRow>>(payoutsUrl, swrOpts);

  const { data: groups = [] } = useSWR<GroupOpt[]>("/groups", swrOpts);
  const { data: allUsers = [] } = useSWR<UserOpt[]>("/users", swrOpts);

  const admins = useMemo(
    () =>
      allUsers
        .filter((x: UserOpt) => x.role === "ADMIN")
        .map((a) => ({ id: a.id, label: a.email })),
    [allUsers],
  );

  const bumpFilters = useCallback(() => {
    setBdPage(1);
    setPyPage(1);
  }, []);

  const refreshAll = useCallback(() => {
    void mutate(
      (key) =>
        typeof key === "string" &&
        (key === "/hq/financial-overview" ||
          key.startsWith("/hq/earnings") ||
          key.startsWith("/hq/payouts") ||
          key === "/groups" ||
          key === "/users"),
    );
  }, [mutate]);

  const split = overview?.platformSplits;
  const adminPct = split?.adminSharePercentage ?? 60;
  const myTurnPct = split?.myTurnSharePercentage ?? 40;

  const combinedErr = errMsg(overviewErr) ?? errMsg(bdErr) ?? errMsg(pyErr);
  const anyValidating = vOv || vBd || vPy;

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Financial overview
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Aggregated from{" "}
            <span className="font-medium text-gray-800">AdminEarning</span> and{" "}
            <span className="font-medium text-gray-800">Payout</span> records.
            Refreshes automatically from the database.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1",
              anyValidating
                ? "bg-amber-50 text-amber-900 ring-amber-200"
                : "bg-brand-green-soft text-brand-green-dark ring-brand-green/30",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                anyValidating
                  ? "animate-pulse bg-amber-500"
                  : "bg-brand-green",
              )}
              aria-hidden
            />
            {anyValidating ? "Updating…" : "Live"} · ~{LIVE_POLL_MS / 1000}s
          </span>
          <button
            type="button"
            onClick={refreshAll}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50 sm:min-h-0"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh now
          </button>
        </div>
      </div>

      {combinedErr && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {combinedErr}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          icon={TrendingUp}
          label="Total revenue (service margins)"
          value={
            loadingOv
              ? "—"
              : moneyLabel(overview?.totalServiceMarginGhs ?? "0")
          }
          loading={loadingOv}
        />
        <StatCard
          icon={PiggyBank}
          label="Total MyTurn earnings"
          value={
            loadingOv
              ? "—"
              : moneyLabel(overview?.totalMyTurnEarningsGhs ?? "0")
          }
          loading={loadingOv}
          iconClassName="text-blue-700"
        />
        <StatCard
          icon={Coins}
          label="Total admin earnings"
          value={
            loadingOv
              ? "—"
              : moneyLabel(overview?.totalAdminEarningsGhs ?? "0")
          }
          loading={loadingOv}
          iconClassName="text-brand-gold-dark"
        />
        <StatCard
          icon={Users}
          label="Payouts completed"
          value={
            loadingOv ? "—" : String(overview?.completedPayoutsCount ?? 0)
          }
          loading={loadingOv}
        />
        <StatCard
          icon={ArrowDownLeft}
          label="Paid to members"
          value={
            loadingOv
              ? "—"
              : moneyLabel(overview?.totalPaidToMembersGhs ?? "0")
          }
          loading={loadingOv}
          iconClassName="text-brand-green"
        />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-card sm:p-6">
        <h3 className="text-sm font-bold text-gray-900">Filters</h3>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="md:col-span-2 xl:col-span-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Search member name
            </label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  bumpFilters();
                }}
                placeholder="Member name or email…"
                className={cn(field, "w-full pl-9")}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Group
            </label>
            <select
              value={groupId}
              onChange={(e) => {
                setGroupId(e.target.value);
                bumpFilters();
              }}
              className={cn(field, "mt-1 w-full")}
            >
              <option value="">All groups</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Admin
            </label>
            <select
              value={adminId}
              onChange={(e) => {
                setAdminId(e.target.value);
                bumpFilters();
              }}
              className={cn(field, "mt-1 w-full")}
            >
              <option value="">All admins</option>
              {admins.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              From date
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                bumpFilters();
              }}
              className={cn(field, "mt-1 w-full")}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              To date
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                bumpFilters();
              }}
              className={cn(field, "mt-1 w-full")}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Payout status
            </label>
            <select
              value={payoutStatus}
              onChange={(e) => {
                setPayoutStatus(e.target.value);
                bumpFilters();
              }}
              className={cn(field, "mt-1 w-full")}
            >
              <option value="">All statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="PENDING">Pending</option>
              <option value="PROCESSING">Processing</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Earnings use settlement date on margin records; payouts use payout date.
          Split labels reflect fixed MVP rules (not editable in HQ):{" "}
          <span className="font-medium text-brand-gold-dark">
            Admin {adminPct}%
          </span>
          ,{" "}
          <span className="font-medium text-blue-700">
            MyTurn {myTurnPct}%
          </span>{" "}
          of each cycle&apos;s margin.
        </p>
      </div>

      <div>
        <h3 className="text-base font-bold text-gray-900">
          Platform earnings breakdown
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          Per group: totals across all finalized cycles (database-backed).
        </p>
        <div className="mt-4 overflow-x-auto">
          {loadingBd ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-xl bg-gray-100"
                />
              ))}
            </div>
          ) : (
            <DataTable<EarningsRow>
              columns={[
                {
                  key: "groupName",
                  header: "Group",
                  render: (r) => (
                    <span className="font-medium text-gray-900">
                      {r.groupName}
                    </span>
                  ),
                },
                { key: "adminName", header: "Admin", render: (r) => r.adminName },
                {
                  key: "contributionAmountGhs",
                  header: "Contribution",
                  render: (r) => moneyLabel(r.contributionAmountGhs),
                },
                { key: "groupSize", header: "Group size" },
                {
                  key: "totalCollectedPerCycleGhs",
                  header: "Total collected",
                  render: (r) => moneyLabel(r.totalCollectedPerCycleGhs),
                },
                {
                  key: "serviceMarginTotalGhs",
                  header: "Service margin",
                  render: (r) => moneyLabel(r.serviceMarginTotalGhs),
                },
                {
                  key: "adminShareTotalGhs",
                  header: `Admin share (${adminPct}%)`,
                  render: (r) => (
                    <span className="font-semibold text-brand-gold-dark">
                      {moneyLabel(r.adminShareTotalGhs)}
                    </span>
                  ),
                },
                {
                  key: "myTurnShareTotalGhs",
                  header: `MyTurn share (${myTurnPct}%)`,
                  render: (r) => (
                    <span className="font-semibold text-blue-700">
                      {moneyLabel(r.myTurnShareTotalGhs)}
                    </span>
                  ),
                },
                { key: "completedCycles", header: "Completed cycles" },
                {
                  key: "totalAdminEarningsGhs",
                  header: "Total admin earnings",
                  render: (r) => moneyLabel(r.totalAdminEarningsGhs),
                },
                {
                  key: "totalMyTurnEarningsGhs",
                  header: "Total MyTurn earnings",
                  render: (r) => moneyLabel(r.totalMyTurnEarningsGhs),
                },
              ]}
              rows={breakdown?.items ?? []}
              rowKey={(r) => r.groupId}
              emptyMessage="No earnings data for these filters."
            />
          )}
        </div>
        {breakdown && breakdown.total > pageSize && (
          <Pagination
            page={bdPage}
            pageSize={pageSize}
            total={breakdown.total}
            onPage={setBdPage}
          />
        )}
      </div>

      <div>
        <h3 className="text-base font-bold text-gray-900">
          Member payout history
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          Every payout with margin split for that cycle.
        </p>
        <div className="mt-4">
          {loadingPy ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-xl bg-gray-100"
                />
              ))}
            </div>
          ) : (
            <DataTable<PayoutRow>
              columns={[
                {
                  key: "memberName",
                  header: "Member",
                  render: (r) => (
                    <span className="font-medium text-gray-900">
                      {r.memberName}
                    </span>
                  ),
                },
                { key: "groupName", header: "Group" },
                { key: "adminName", header: "Admin" },
                {
                  key: "payoutPosition",
                  header: "Payout position",
                  render: (r) => (
                    <span>
                      Turn {r.payoutPosition ?? "—"} · cycle {r.cycleNumber}
                    </span>
                  ),
                },
                {
                  key: "payoutAmountGhs",
                  header: "Payout amount",
                  render: (r) => (
                    <span className="font-bold text-brand-green">
                      {moneyLabel(r.payoutAmountGhs)}
                    </span>
                  ),
                },
                {
                  key: "serviceMarginGhs",
                  header: "Service margin",
                  render: (r) => moneyLabel(r.serviceMarginGhs),
                },
                {
                  key: "adminShareGhs",
                  header: `Admin share (${adminPct}%)`,
                  render: (r) => (
                    <span className="text-brand-gold-dark">
                      {moneyLabel(r.adminShareGhs)}
                    </span>
                  ),
                },
                {
                  key: "myTurnShareGhs",
                  header: `MyTurn share (${myTurnPct}%)`,
                  render: (r) => (
                    <span className="text-blue-700">
                      {moneyLabel(r.myTurnShareGhs)}
                    </span>
                  ),
                },
                {
                  key: "payoutDate",
                  header: "Payout date",
                  render: (r) =>
                    new Date(r.payoutDate).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }),
                },
                {
                  key: "status",
                  header: "Status",
                  render: (r) => <StatusBadge status={r.status} />,
                },
              ]}
              rows={payouts?.items ?? []}
              rowKey={(r) => r.payoutId}
              emptyMessage="No payouts for these filters."
            />
          )}
        </div>
        {payouts && payouts.total > pageSize && (
          <Pagination
            page={pyPage}
            pageSize={pageSize}
            total={payouts.total}
            onPage={setPyPage}
          />
        )}
      </div>
    </div>
  );
}

function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4 text-sm">
      <span className="text-gray-600">
        {total} rows · page {page} of {pages}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="rounded-xl border border-gray-300 bg-white px-3 py-2 font-medium text-gray-800 disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className="rounded-xl border border-gray-300 bg-white px-3 py-2 font-medium text-gray-800 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
