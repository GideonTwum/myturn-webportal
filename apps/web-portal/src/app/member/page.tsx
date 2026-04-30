"use client";

import { FormEvent, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useSWR, useSWRConfig } from "@/lib/swr";
import { cn } from "@/lib/cn";

type ParticipationRow = {
  groupId: string;
  groupName: string;
  groupStatus: string;
  payoutMode: string;
  turnOrder: number;
  memberSlots: number;
  payoutPositionLabel: string;
  contributionAmount: string;
  daysPerCycle: number;
  currentCycle: number;
  totalCycles: number;
  contributionId: string | null;
  paidDayCount: number;
  expectedDayCount: number;
  remainingDays: number;
  contributionStatus: string | null;
  cycleStanding: string;
};

type ParticipationRes = { memberships: ParticipationRow[] };

function labelContributionAmount(p: ParticipationRow) {
  return p.payoutMode === "DAILY"
    ? "Contribution (per cycle)"
    : "Contribution (per day)";
}

export default function MemberHomePage() {
  const { mutate } = useSWRConfig();
  const { data, error, isLoading } = useSWR<ParticipationRes>(
    "/groups/member/participation",
  );
  const [payBusy, setPayBusy] = useState<string | null>(null);
  const [payMsg, setPayMsg] = useState<string | null>(null);

  async function recordPayment(contributionId: string) {
    setPayMsg(null);
    setPayBusy(contributionId);
    try {
      await apiFetch("/payments/mock/contribution-payment", {
        method: "POST",
        body: JSON.stringify({ contributionId }),
      });
      await mutate("/groups/member/participation");
      setPayMsg("Payment recorded.");
    } catch (e) {
      setPayMsg(
        e instanceof Error ? e.message : "Could not record payment.",
      );
    } finally {
      setPayBusy(null);
    }
  }

  function onPayClick(e: FormEvent, contributionId: string) {
    e.preventDefault();
    void recordPayment(contributionId);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Your groups</h1>
      <p className="mt-1 text-sm text-gray-600">
        Track contributions and record mock payments until the mobile app is
        ready.
      </p>

      {error && (
        <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error instanceof Error ? error.message : "Failed to load"}
        </p>
      )}

      {payMsg && (
        <p className="mt-4 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800">
          {payMsg}
        </p>
      )}

      {isLoading && (
        <p className="mt-8 text-sm text-gray-500">Loading your groups…</p>
      )}

      {!isLoading && data?.memberships.length === 0 && (
        <p className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-600">
          You are not in any groups yet.{" "}
          <a href="/join" className="font-semibold text-brand-green hover:underline">
            Join with a code
          </a>
          .
        </p>
      )}

      <ul className="mt-6 space-y-4">
        {(data?.memberships ?? []).map((p) => {
          const canPay =
            p.groupStatus === "ACTIVE" &&
            p.contributionId &&
            p.contributionStatus === "PENDING" &&
            p.remainingDays > 0;

          return (
            <li
              key={p.groupId}
              className={cn(
                "rounded-2xl border border-gray-200 bg-white p-5 shadow-sm",
              )}
            >
              <h2 className="text-lg font-semibold text-gray-900">
                {p.groupName}
              </h2>
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                {p.groupStatus === "DRAFT" && "Waiting for the group to fill"}
                {p.groupStatus === "ACTIVE" && "Active"}
                {p.groupStatus === "COMPLETED" && "Completed"}
                {p.groupStatus === "CANCELLED" && "Cancelled"}
              </p>

              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Payout position</dt>
                  <dd className="font-medium text-gray-900">
                    {p.payoutPositionLabel}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">{labelContributionAmount(p)}</dt>
                  <dd className="font-medium text-gray-900">
                    GHS {p.contributionAmount}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Days this cycle</dt>
                  <dd className="font-medium text-gray-900">
                    {p.daysPerCycle}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Cycle</dt>
                  <dd className="text-gray-900">
                    {p.currentCycle} / {p.totalCycles}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Paid days / Total</dt>
                  <dd className="font-medium text-gray-900">
                    {p.paidDayCount} / {p.expectedDayCount}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Remaining days</dt>
                  <dd className="font-semibold text-brand-green-dark">
                    {p.groupStatus === "ACTIVE" ? p.remainingDays : "—"}
                  </dd>
                </div>
                {p.payoutMode === "CYCLE" && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500">Standing</dt>
                    <dd className="text-gray-900">{p.cycleStanding}</dd>
                  </div>
                )}
              </dl>

              {canPay && (
                <form
                  className="mt-5"
                  onSubmit={(e) => onPayClick(e, p.contributionId!)}
                >
                  <button
                    type="submit"
                    disabled={payBusy === p.contributionId}
                    className="w-full min-h-[48px] rounded-xl border-2 border-brand-green bg-brand-green-soft py-3 text-sm font-bold text-brand-green-dark transition-colors hover:bg-brand-green/15 disabled:opacity-50"
                  >
                    {payBusy === p.contributionId
                      ? "Recording…"
                      : "Record payment"}
                  </button>
                  <p className="mt-2 text-center text-xs text-gray-500">
                    One tap = one day&apos;s contribution (mock / staging).
                  </p>
                </form>
              )}

              {p.groupStatus === "DRAFT" && (
                <p className="mt-4 text-xs text-gray-500">
                  You&apos;ll be able to record payments after the admin
                  activates the group.
                </p>
              )}

              {p.groupStatus === "ACTIVE" &&
                p.contributionStatus === "PAID" &&
                p.contributionId && (
                  <p className="mt-4 text-sm font-medium text-brand-green-dark">
                    You&apos;ve completed your payments for this cycle.
                  </p>
                )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
