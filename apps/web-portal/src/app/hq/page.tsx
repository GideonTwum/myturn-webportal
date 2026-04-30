"use client";

import { motion } from "framer-motion";
import {
  Building2,
  FileText,
  RefreshCw,
  UserCog,
  Users,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { LIVE_POLL_MS, useSWR, useSWRConfig } from "@/lib/swr";
import { cn } from "@/lib/cn";

type HqOverview = {
  totalUsers: number;
  totalAdmins: number;
  activeGroups: number;
  completedGroups: number;
  pendingAdminRequests: number;
};

function errMsg(e: unknown): string | null {
  if (!e) return null;
  if (e instanceof Error) return e.message;
  return "Failed";
}

export default function HqHomePage() {
  const { mutate } = useSWRConfig();
  const {
    data,
    error,
    isLoading,
    isValidating,
  } = useSWR<HqOverview>("/hq/overview", {
    refreshInterval: LIVE_POLL_MS,
  });

  const refresh = () => void mutate("/hq/overview");

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-600">
          High-level platform snapshot — open{" "}
          <span className="font-semibold text-gray-900">Financial Overview</span>{" "}
          for revenue and payouts.
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
            onClick={refresh}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>
      {errMsg(error) && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errMsg(error)}
        </p>
      )}
      <motion.div
        className="mt-8"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard
            icon={Users}
            label="Total users"
            value={isLoading ? "—" : String(data?.totalUsers ?? 0)}
            loading={isLoading}
          />
          <StatCard
            icon={UserCog}
            label="Total admins"
            value={isLoading ? "—" : String(data?.totalAdmins ?? 0)}
            loading={isLoading}
          />
          <StatCard
            icon={Building2}
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
            icon={FileText}
            label="Pending admin requests"
            value={isLoading ? "—" : String(data?.pendingAdminRequests ?? 0)}
            loading={isLoading}
            iconClassName="text-brand-gold-dark"
          />
        </div>
      </motion.div>
    </div>
  );
}
