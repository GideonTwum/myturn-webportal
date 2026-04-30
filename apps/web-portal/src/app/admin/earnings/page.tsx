"use client";

import {
  ADMIN_MARGIN_SHARE_BPS,
  PLATFORM_MARGIN_SHARE_BPS,
} from "@myturn/shared";
import { LIVE_POLL_MS, useSWR } from "@/lib/swr";
import { DataTable } from "@/components/dashboard/DataTable";

type Earning = {
  id: string;
  cycleNumber: number | null;
  adminShareAmount: string;
  platformShareAmount: string;
  marginAmount: string;
  group: { name: string } | null;
};

export default function AdminEarningsPage() {
  const { data: rows, error: err, isLoading: loading } = useSWR<Earning[]>(
    "/admin-earnings/mine",
    { refreshInterval: LIVE_POLL_MS },
  );

  return (
    <div className="mx-auto max-w-7xl">
      <p className="max-w-2xl text-sm text-gray-600">
        Your share of the service margin per finalized cycle. Platform rule:{" "}
        <span className="font-semibold text-brand-gold-dark">
          {ADMIN_MARGIN_SHARE_BPS / 100}% Admin
        </span>
        ,{" "}
        <span className="font-semibold text-blue-700">
          {PLATFORM_MARGIN_SHARE_BPS / 100}% MyTurn HQ
        </span>{" "}
        (applied to margin only).
      </p>
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
                className="h-20 animate-pulse rounded-xl bg-gray-200/80"
              />
            ))}
          </div>
        ) : (
          <DataTable<Earning>
            columns={[
              {
                key: "group",
                header: "Group / cycle",
                render: (r) => (
                  <div>
                    <p className="font-medium text-gray-900">
                      {r.group?.name ?? "—"}
                    </p>
                    <p className="text-xs text-gray-500">
                      Cycle {r.cycleNumber ?? "—"}
                    </p>
                  </div>
                ),
              },
              {
                key: "marginAmount",
                header: "Margin",
                render: (r) => <span>GHS {r.marginAmount}</span>,
              },
              {
                key: "adminShareAmount",
                header: "Your earnings",
                render: (r) => (
                  <span className="font-semibold text-brand-gold-dark">
                    GHS {r.adminShareAmount}
                  </span>
                ),
              },
              {
                key: "platformShareAmount",
                header: "MyTurn HQ",
                render: (r) => (
                  <span className="font-medium text-blue-700">
                    GHS {r.platformShareAmount}
                  </span>
                ),
              },
            ]}
            rows={rows ?? []}
            rowKey={(r) => r.id}
            emptyMessage="No earnings yet — finalize a group cycle with all contributions paid."
          />
        )}
      </div>
    </div>
  );
}
