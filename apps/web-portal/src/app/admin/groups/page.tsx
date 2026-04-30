"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { LIVE_POLL_MS, useSWR } from "@/lib/swr";
import { DataTable } from "@/components/dashboard/DataTable";
import { StatusBadge } from "@/components/dashboard/StatusBadge";

type GroupRow = {
  id: string;
  name: string;
  status: string;
  currentCycle: number;
  contributionAmount: string;
  frequency: string;
  _count: { members: number };
};

export default function AdminGroupsPage() {
  const { data: groups, error: err, isLoading: loading } = useSWR<GroupRow[]>(
    "/groups/mine",
    { refreshInterval: LIVE_POLL_MS },
  );

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-600">
          Manage your savings groups and member slots.
        </p>
        <Link
          href="/admin/create-group"
          className="inline-flex min-h-[44px] items-center justify-center gap-2 self-start rounded-xl bg-brand-green px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-green-dark sm:min-h-0"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          New group
        </Link>
      </div>
      {err && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err instanceof Error ? err.message : "Failed"}
        </p>
      )}
      <div className="mt-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-xl bg-gray-200/80"
              />
            ))}
          </div>
        ) : (
          <DataTable<GroupRow>
            columns={[
              {
                key: "name",
                header: "Group",
                render: (g) => (
                  <Link
                    href={`/admin/groups/${g.id}`}
                    className="font-medium text-brand-green hover:underline"
                  >
                    {g.name}
                  </Link>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (g) => <StatusBadge status={g.status} />,
              },
              {
                key: "frequency",
                header: "Schedule",
                render: (g) => (
                  <span>
                    {g.frequency} · GHS {g.contributionAmount}
                  </span>
                ),
              },
              {
                key: "cycle",
                header: "Cycle",
                className: "text-right",
                render: (g) => (
                  <span>
                    {g.status === "ACTIVE" || g.status === "COMPLETED"
                      ? g.currentCycle
                      : "—"}
                  </span>
                ),
              },
              {
                key: "members",
                header: "Members",
                className: "text-right",
                render: (g) => (
                  <span>
                    {g._count.members}{" "}
                    <span className="text-gray-400">filled</span>
                  </span>
                ),
              },
            ]}
            rows={groups ?? []}
            rowKey={(g) => g.id}
            emptyMessage="No groups yet. Create one to get started."
          />
        )}
      </div>
    </div>
  );
}
