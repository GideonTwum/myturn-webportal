"use client";

import { LIVE_POLL_MS, useSWR } from "@/lib/swr";
import { DataTable } from "@/components/dashboard/DataTable";
import { StatusBadge } from "@/components/dashboard/StatusBadge";

type GroupRow = {
  id: string;
  name: string;
  status: string;
  admin: { email: string };
};

export default function HqGroupsPage() {
  const { data: groups, error: err, isLoading: loading } = useSWR<GroupRow[]>(
    "/groups",
    { refreshInterval: LIVE_POLL_MS },
  );

  return (
    <div className="mx-auto max-w-7xl">
      <p className="text-sm text-gray-600">Cross-tenant group visibility.</p>
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
                  <span className="font-medium text-gray-900">{g.name}</span>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (g) => <StatusBadge status={g.status} />,
              },
              {
                key: "admin",
                header: "Admin",
                render: (g) => (
                  <span className="text-gray-600">{g.admin.email}</span>
                ),
              },
            ]}
            rows={groups ?? []}
            rowKey={(g) => g.id}
            emptyMessage="No groups yet."
          />
        )}
      </div>
    </div>
  );
}
