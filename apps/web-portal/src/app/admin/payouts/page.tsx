"use client";

import { useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { LIVE_POLL_MS, useSWR, useSWRConfig } from "@/lib/swr";
import { ConfirmDialog } from "@/components/dashboard/ConfirmDialog";
import { DataTable } from "@/components/dashboard/DataTable";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { cn } from "@/lib/cn";

type PayoutRow = {
  id: string;
  cycleNumber: number;
  amount: string;
  status: string;
  recipientId: string;
};

type GroupMini = { id: string; name: string };

type PayoutReadiness = {
  groupId: string;
  groupName: string;
  groupStatus: string;
  currentCycle: number;
  totalCycles: number;
  contributionAmount: string;
  daysPerCycle: number;
  payoutMode: "DAILY" | "CYCLE";
  defaultGraceDays?: number;
  allowPayoutOverride?: boolean;
  complianceBlocksPayout?: boolean;
  recipientDefaultBlocked?: boolean;
  hasDefaultedMembers?: boolean;
  unpaidMembers: {
    userId: string;
    email: string;
    turnOrder: number;
  }[];
  expectedPayoutRecipient: {
    userId: string;
    email: string;
    turnOrder: number;
  } | null;
  canFinalize: boolean;
  payoutForCurrentCycleExists: boolean;
  allContributionsPaidForCurrentCycle: boolean;
};

const fieldClass = cn(
  "mt-1 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900",
  "outline-none ring-brand-green/20 focus:border-brand-green focus:ring-2",
);

export default function AdminPayoutsPage() {
  const { mutate } = useSWRConfig();
  const { data: groups, error: groupsErr, isLoading: groupsLoading } = useSWR<
    GroupMini[]
  >("/groups/mine", { refreshInterval: LIVE_POLL_MS });

  const [groupId, setGroupId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const firstId = groups?.[0]?.id ?? "";
  const effectiveGroupId = groupId || firstId;

  const readinessUrl = effectiveGroupId
    ? `/groups/${effectiveGroupId}/payout-readiness`
    : null;
  const { data: readiness } = useSWR<PayoutReadiness>(readinessUrl, {
    refreshInterval: LIVE_POLL_MS,
  });

  const payoutsUrl = effectiveGroupId
    ? `/payouts/group/${effectiveGroupId}`
    : null;
  const { data: rows, isLoading: loadingPayouts } = useSWR<PayoutRow[]>(
    payoutsUrl,
    { refreshInterval: LIVE_POLL_MS },
  );

  const confirmBody = useMemo(() => {
    if (!readiness) return "";
    const r = readiness.expectedPayoutRecipient;
    const unpaid = readiness.unpaidMembers;
    let text = "";
    if (r) {
      text += `Payout will go to member ${r.email} (turn order ${r.turnOrder}).\n\n`;
    }
    if (unpaid.length > 0) {
      text += `Unpaid members (${unpaid.length}): ${unpaid.map((u) => u.email).join(", ")}. Finalize is blocked until all pay.\n\n`;
    } else {
      text += "All members have paid for the current cycle.\n\n";
    }
    text +=
      "MoMo is not integrated — this only records ledger + payout rows for staging.";
    return text;
  }, [readiness]);

  async function finalize() {
    if (!readiness || !effectiveGroupId) return;
    setMsg(null);
    setErr(null);
    try {
      await apiFetch("/payouts/mock/finalize-cycle", {
        method: "POST",
        body: JSON.stringify({
          groupId: effectiveGroupId,
          cycleNumber: readiness.currentCycle,
        }),
      });
      setMsg(
        readiness.currentCycle >= readiness.totalCycles
          ? "Final cycle finalized — group marked completed."
          : `Cycle ${readiness.currentCycle} finalized. Next cycle is live.`,
      );
      void mutate(readinessUrl);
      void mutate(payoutsUrl);
      void mutate("/groups/mine");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-sm text-gray-600">
          Finalize a cycle after all members have contributed; payout follows turn
          order.{" "}
          <span className="font-medium text-gray-800">
            MoMo integration coming soon
          </span>
          — mock payout completion for staging only.
        </p>
        <button
          type="button"
          onClick={() => {
            void mutate(readinessUrl);
            void mutate(payoutsUrl);
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
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[180px] flex-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Group
            </label>
            <select
              value={effectiveGroupId}
              onChange={(e) => setGroupId(e.target.value)}
              className={cn(fieldClass, "w-full")}
            >
              {(groups ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={!readiness?.canFinalize}
            onClick={() => setConfirmOpen(true)}
            className="min-h-[44px] w-full rounded-xl bg-brand-green px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-green-dark enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-h-0"
          >
            Finalize cycle {readiness?.currentCycle ?? "…"}
          </button>
        </div>
      )}

      {readiness && readiness.groupStatus === "ACTIVE" && (
        <div className="mt-6 space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-card sm:p-5">
          <h3 className="text-sm font-bold text-gray-900">Current round</h3>
          {readiness.payoutMode === "CYCLE" &&
            (readiness.complianceBlocksPayout ||
              readiness.recipientDefaultBlocked) &&
            !readiness.allowPayoutOverride && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                Cycle compliance blocks payout: a member is DEFAULTED or the
                recipient cannot be paid. Replace the member in admin tools or
                enable payout override in cycle risk settings.
              </p>
            )}
          {readiness.payoutMode === "CYCLE" &&
            readiness.allowPayoutOverride &&
            readiness.hasDefaultedMembers && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                Payout override is on — you may finalize despite DEFAULTED
                members (use only for ops / staging).
              </p>
            )}
          <p className="text-sm text-gray-600">
            Cycle <span className="font-semibold">{readiness.currentCycle}</span>{" "}
            of <span className="font-semibold">{readiness.totalCycles}</span>
            {readiness.payoutMode === "DAILY" ? (
              <span className="text-gray-600">
                {" "}
                · One payment per member this cycle
              </span>
            ) : (
              readiness.daysPerCycle > 1 && (
                <span className="text-gray-600">
                  {" "}
                  · {readiness.daysPerCycle} payments per member this cycle
                </span>
              )
            )}
            {readiness.payoutForCurrentCycleExists && (
              <span className="ml-2 text-brand-green">
                · Payout already recorded for this cycle
              </span>
            )}
          </p>
          {readiness.expectedPayoutRecipient && (
            <div className="rounded-xl border border-brand-green/30 bg-brand-green-soft/50 px-4 py-3 text-sm">
              <span className="font-semibold text-brand-green-dark">
                Current payout recipient:
              </span>{" "}
              {readiness.expectedPayoutRecipient.email} (turn order{" "}
              {readiness.expectedPayoutRecipient.turnOrder})
            </div>
          )}
          {readiness.unpaidMembers.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <span className="font-bold">Unpaid ({readiness.unpaidMembers.length})</span>
              <ul className="mt-2 list-inside list-disc">
                {readiness.unpaidMembers.map((u) => (
                  <li key={u.userId}>
                    {u.email}{" "}
                    <span className="text-amber-800/80">
                      (turn {u.turnOrder})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {readiness.unpaidMembers.length === 0 &&
            readiness.groupStatus === "ACTIVE" &&
            !readiness.payoutForCurrentCycleExists && (
              <p className="text-sm font-medium text-green-800">
                All members paid — you can finalize this cycle.
              </p>
            )}
        </div>
      )}

      {readiness?.groupStatus === "COMPLETED" && (
        <p className="mt-6 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
          This group has completed all cycles. No further payouts.
        </p>
      )}

      {msg && (
        <p className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {msg}
        </p>
      )}
      {err && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </p>
      )}
      <div className="mt-6">
        {groupsLoading || loadingPayouts ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-xl bg-gray-200/80"
              />
            ))}
          </div>
        ) : (
          <DataTable<PayoutRow>
            columns={[
              {
                key: "cycleNumber",
                header: "Cycle",
                render: (r) => <span>Cycle {r.cycleNumber}</span>,
              },
              {
                key: "amount",
                header: "Payout",
                render: (r) => (
                  <span className="font-semibold text-brand-green">
                    GHS {r.amount}
                  </span>
                ),
              },
              {
                key: "status",
                header: "Status",
                render: (r) => <StatusBadge status={r.status} />,
              },
            ]}
            rows={rows ?? []}
            rowKey={(r) => r.id}
            emptyMessage="No payouts recorded yet."
          />
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm mock payout for this cycle?"
        description={confirmBody}
        confirmLabel="Finalize cycle"
        cancelLabel="Cancel"
        confirmVariant="primary"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          void finalize();
        }}
      />
    </div>
  );
}
