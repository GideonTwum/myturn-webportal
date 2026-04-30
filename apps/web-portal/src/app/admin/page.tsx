"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowDownLeft,
  Building2,
  Coins,
  Radio,
  RefreshCw,
  Users,
} from "lucide-react";
import { formatGhs } from "@myturn/shared";
import { StatCard } from "@/components/dashboard/StatCard";
import { cn } from "@/lib/cn";
import { LIVE_POLL_MS, useSWR, useSWRConfig } from "@/lib/swr";

type AdminOverview = {
  groupsCreated: number;
  activeGroups: number;
  completedGroups: number;
  totalMembers: number;
  totalMarginEarningsGhs: string;
  completedPayoutsCount: number;
  totalPaidToMembersGhs: string;
};

export default function AdminHomePage() {
  const { mutate } = useSWRConfig();
  const { data, error, isLoading, isValidating } = useSWR<AdminOverview>(
    "/admin/overview",
    { refreshInterval: LIVE_POLL_MS },
  );

  const margin = Number(data?.totalMarginEarningsGhs ?? 0);
  const paid = Number(data?.totalPaidToMembersGhs ?? 0);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-600">
          Live snapshot of your groups and earnings — updates automatically.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1",
              isValidating
                ? "bg-amber-50 text-amber-900 ring-amber-200"
                : "bg-brand-green-soft text-brand-green-dark ring-brand-green/30",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                isValidating ? "animate-pulse bg-amber-500" : "bg-brand-green",
              )}
              aria-hidden
            />
            Live · ~{LIVE_POLL_MS / 1000}s
          </span>
          <button
            type="button"
            onClick={() => void mutate("/admin/overview")}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>
      {error && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error instanceof Error ? error.message : "Failed to load"}
        </p>
      )}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="mt-8"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            icon={Building2}
            label="Groups created"
            value={isLoading ? "—" : String(data?.groupsCreated ?? 0)}
            loading={isLoading}
          />
          <StatCard
            icon={Radio}
            label="Active groups"
            value={isLoading ? "—" : String(data?.activeGroups ?? 0)}
            loading={isLoading}
            iconClassName="text-emerald-600"
          />
          <StatCard
            icon={Building2}
            label="Completed groups"
            value={isLoading ? "—" : String(data?.completedGroups ?? 0)}
            loading={isLoading}
            iconClassName="text-blue-700"
          />
          <StatCard
            icon={Users}
            label="Total members"
            value={isLoading ? "—" : String(data?.totalMembers ?? 0)}
            loading={isLoading}
          />
          <StatCard
            icon={Coins}
            label="Your margin earnings (cumulative)"
            value={
              isLoading ? "—" : formatGhs(Number.isFinite(margin) ? margin : 0)
            }
            loading={isLoading}
            iconClassName="text-brand-gold-dark"
          />
          <StatCard
            icon={ArrowDownLeft}
            label="Payouts completed"
            value={
              isLoading ? "—" : String(data?.completedPayoutsCount ?? 0)
            }
            loading={isLoading}
            iconClassName="text-brand-green"
          />
          <Link href="/admin/earnings" className="block sm:col-span-2 xl:col-span-1">
            <StatCard
              icon={Coins}
              label="View earnings detail →"
              value={
                isLoading
                  ? "—"
                  : `Paid out ${formatGhs(Number.isFinite(paid) ? paid : 0)} to members`
              }
              loading={isLoading}
              className="h-full cursor-pointer transition-all hover:border-brand-gold/50 hover:shadow-card-md"
            />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
