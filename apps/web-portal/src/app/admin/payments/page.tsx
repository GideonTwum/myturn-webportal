"use client";

import { LIVE_POLL_MS, useSWR, useSWRConfig } from "@/lib/swr";
import { DataTable } from "@/components/dashboard/DataTable";
import { StatusBadge } from "@/components/dashboard/StatusBadge";

type AdminPayment = {
  id: string;
  reference: string;
  memberName: string | null;
  groupName: string | null;
  amount: string;
  status: string;
  provider: string;
  createdAt: string;
  settledAt: string | null;
};

type PaymentsPayload = { payments: AdminPayment[] };

export default function AdminPaymentsPage() {
  const { mutate } = useSWRConfig();
  const { data, error: err, isLoading: loading } = useSWR<PaymentsPayload>(
    "/admin/payments",
    { refreshInterval: LIVE_POLL_MS },
  );
  const rows = data?.payments ?? [];

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="mt-1 text-sm text-gray-600">
            Contribution payments for groups you manage. Scoped to your admin account only.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void mutate("/admin/payments")}
          className="shrink-0 rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>
      {err && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err instanceof Error ? err.message : "Failed to load payments"}
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
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
            No payments recorded yet for your groups.
          </p>
        ) : (
          <DataTable<AdminPayment>
            columns={[
              {
                key: "reference",
                header: "Reference",
                render: (r) => (
                  <span className="font-mono text-xs text-gray-700">{r.reference}</span>
                ),
              },
              {
                key: "member",
                header: "Member",
                render: (r) => (
                  <span className="text-gray-900">{r.memberName ?? "—"}</span>
                ),
              },
              {
                key: "group",
                header: "Group",
                render: (r) => (
                  <span className="text-gray-700">{r.groupName ?? "—"}</span>
                ),
              },
              {
                key: "amount",
                header: "Amount",
                render: (r) => (
                  <span className="font-semibold text-gray-900">GHS {r.amount}</span>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (r) => <StatusBadge status={r.status} />,
              },
              {
                key: "provider",
                header: "Provider",
                render: (r) => <span className="text-gray-700">{r.provider}</span>,
              },
              {
                key: "created",
                header: "Created",
                render: (r) => (
                  <span className="text-xs text-gray-600">
                    {new Date(r.createdAt).toLocaleString()}
                  </span>
                ),
              },
              {
                key: "settled",
                header: "Settled",
                render: (r) => (
                  <span className="text-xs text-gray-600">
                    {r.settledAt ? new Date(r.settledAt).toLocaleString() : "—"}
                  </span>
                ),
              },
            ]}
            rows={rows}
            rowKey={(r) => r.id}
            emptyMessage="No payments."
          />
        )}
      </div>
    </div>
  );
}
