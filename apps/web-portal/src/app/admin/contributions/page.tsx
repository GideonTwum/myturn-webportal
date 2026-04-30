"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { LIVE_POLL_MS, useSWR, useSWRConfig } from "@/lib/swr";
import { DataTable } from "@/components/dashboard/DataTable";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { cn } from "@/lib/cn";

type Contrib = {
  id: string;
  userId?: string;
  cycleNumber: number;
  status: string;
  amount: string;
  paidDayCount: number;
  expectedDayCount: number;
  user: { id?: string; email: string };
};

type GroupMini = { id: string; name: string };

type PayoutReadiness = {
  currentCycle: number;
  groupStatus: string;
  daysPerCycle?: number;
  payoutMode?: "DAILY" | "CYCLE";
  unpaidMembers: { userId: string; email: string }[];
};

const selectClass = cn(
  "mt-1 w-full max-w-md rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900",
  "outline-none ring-brand-green/20 focus:border-brand-green focus:ring-2",
);

export default function AdminContributionsPage() {
  const { mutate } = useSWRConfig();
  const [groupId, setGroupId] = useState("");

  const { data: groups, error: groupsErr, isLoading: groupsLoading } = useSWR<
    GroupMini[]
  >("/groups/mine", { refreshInterval: LIVE_POLL_MS });

  const firstId = groups?.[0]?.id ?? "";
  const effectiveGroupId = groupId || firstId;

  const readinessUrl = effectiveGroupId
    ? `/groups/${effectiveGroupId}/payout-readiness`
    : null;
  const { data: readiness } = useSWR<PayoutReadiness>(readinessUrl, {
    refreshInterval: LIVE_POLL_MS,
  });

  const contribUrl = effectiveGroupId
    ? `/contributions/group/${effectiveGroupId}`
    : null;
  const { data: allRows, isLoading: rowsLoading } = useSWR<Contrib[]>(
    contribUrl,
    { refreshInterval: LIVE_POLL_MS },
  );

  const cycle = readiness?.currentCycle ?? 0;
  const rows = allRows?.filter((r) => r.cycleNumber === cycle) ?? [];

  const unpaidSet = new Set(readiness?.unpaidMembers.map((u) => u.userId));

  async function recordPayment(contributionId: string) {
    await apiFetch("/payments/mock/contribution-payment", {
      method: "POST",
      body: JSON.stringify({ contributionId }),
    });
    void mutate(contribUrl);
    void mutate(readinessUrl);
    void mutate("/groups/mine");
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-sm text-gray-600">
          <span className="font-medium text-gray-800">
            MoMo integration coming soon.
          </span>{" "}
          For now, use record payment below for mock/manual testing (current cycle
          only).
        </p>
        <button
          type="button"
          onClick={() => {
            void mutate(contribUrl);
            void mutate(readinessUrl);
            void mutate("/groups/mine");
          }}
          className="shrink-0 rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>
      {groupsErr && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {groupsErr instanceof Error ? groupsErr.message : "Failed"}
        </p>
      )}
      {groups && groups.length > 0 && (
        <div className="mt-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Group
          </label>
          <select
            value={effectiveGroupId}
            onChange={(e) => setGroupId(e.target.value)}
            className={selectClass}
          >
            {(groups ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {readiness?.groupStatus === "ACTIVE" && cycle > 0 && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-card">
          <span className="font-semibold text-gray-900">Current cycle:</span>{" "}
          {cycle}
          {readiness.payoutMode === "DAILY" ? (
            <span className="text-gray-600">
              {" "}
              · One payment per member per cycle
            </span>
          ) : (
            readiness.daysPerCycle != null &&
            readiness.daysPerCycle > 1 && (
              <span className="text-gray-600">
                {" "}
                · {readiness.daysPerCycle} payments per member per cycle
              </span>
            )
          )}
          {readiness.unpaidMembers.length > 0 && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950">
              <span className="font-bold">
                Unpaid this cycle ({readiness.unpaidMembers.length})
              </span>
              <ul className="mt-1 list-inside list-disc text-sm">
                {readiness.unpaidMembers.map((u) => (
                  <li key={u.userId}>{u.email}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <div className="mt-6">
        {groupsLoading || rowsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-xl bg-gray-200/80"
              />
            ))}
          </div>
        ) : (
          <DataTable<Contrib>
            columns={[
              {
                key: "email",
                header: "Member",
                render: (r) => {
                  const uid = r.userId ?? r.user.id ?? "";
                  const showUnpaid =
                    r.status === "PENDING" &&
                    r.cycleNumber === cycle &&
                    unpaidSet.has(uid);
                  return (
                    <span
                      className={cn(
                        "font-medium",
                        showUnpaid ? "text-amber-900" : "text-gray-900",
                      )}
                    >
                      {r.user.email}
                      {showUnpaid && (
                        <span className="ml-2 text-xs font-bold uppercase text-amber-700">
                          Unpaid
                        </span>
                      )}
                    </span>
                  );
                },
              },
              {
                key: "cycleNumber",
                header: "Cycle",
                render: (r) => <span>Cycle {r.cycleNumber}</span>,
              },
              {
                key: "days",
                header: "Paid / days",
                render: (r) => (
                  <span className="text-sm text-gray-800">
                    {r.paidDayCount ?? 0} / {r.expectedDayCount ?? 1}
                  </span>
                ),
              },
              {
                key: "amount",
                header: "Cycle total",
                render: (r) => <span>GHS {r.amount}</span>,
              },
              {
                key: "status",
                header: "Status",
                render: (r) => <StatusBadge status={r.status} />,
              },
              {
                key: "pay",
                header: "Mock pay",
                render: (r) =>
                  readiness?.groupStatus === "ACTIVE" &&
                  r.cycleNumber === cycle &&
                  r.status !== "PAID" ? (
                    <button
                      type="button"
                      onClick={() => void recordPayment(r.id)}
                      className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                    >
                      Record
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  ),
              },
            ]}
            rows={rows}
            rowKey={(r) => r.id}
            emptyMessage={
              cycle
                ? `No rows for cycle ${cycle}.`
                : "No contributions loaded for this group."
            }
          />
        )}
      </div>
    </div>
  );
}
