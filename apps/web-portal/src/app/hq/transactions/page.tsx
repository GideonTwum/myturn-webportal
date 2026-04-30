"use client";

import { LIVE_POLL_MS, useSWR, useSWRConfig } from "@/lib/swr";
import { DataTable } from "@/components/dashboard/DataTable";
import { StatusBadge } from "@/components/dashboard/StatusBadge";

type Tx = {
  id: string;
  amount: string;
  status: string;
  type: string;
  user: { email: string } | null;
  group: { name: string } | null;
  createdAt: string;
};

export default function HqTransactionsPage() {
  const { mutate } = useSWRConfig();
  const { data: rows, error: err, isLoading: loading } = useSWR<Tx[]>(
    "/transactions",
    { refreshInterval: LIVE_POLL_MS },
  );

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-sm text-gray-600">
          <span className="font-semibold">Payments only</span> (contribution
          mock records). Completed member payouts appear under Financial Overview
          and group payout history — not in this table.
        </p>
        <button
          type="button"
          onClick={() => void mutate("/transactions")}
          className="shrink-0 rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>
      {err && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err instanceof Error ? err.message : "Failed"}
        </p>
      )}
      <div className="mt-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-xl bg-gray-200/80"
              />
            ))}
          </div>
        ) : (
          <DataTable<Tx>
            columns={[
              {
                key: "amount",
                header: "Amount",
                render: (r) => (
                  <span className="font-semibold text-gray-900">
                    GHS {r.amount}
                  </span>
                ),
              },
              {
                key: "type",
                header: "Type",
                render: (r) => <span className="text-gray-700">{r.type}</span>,
              },
              {
                key: "status",
                header: "Status",
                render: (r) => <StatusBadge status={r.status} />,
              },
              {
                key: "meta",
                header: "User / group",
                render: (r) => (
                  <div className="text-xs text-gray-600">
                    <p>{r.user?.email ?? "—"}</p>
                    <p>{r.group?.name ?? "—"}</p>
                  </div>
                ),
              },
              {
                key: "createdAt",
                header: "Date",
                render: (r) => (
                  <span className="text-gray-500">
                    {new Date(r.createdAt).toLocaleString()}
                  </span>
                ),
              },
            ]}
            rows={rows ?? []}
            rowKey={(r) => r.id}
            emptyMessage="No transactions."
          />
        )}
      </div>
    </div>
  );
}
