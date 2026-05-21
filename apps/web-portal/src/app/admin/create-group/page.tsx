"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import {
  ADMIN_SHARE_PERCENTAGE,
  computeGroupFinancePreview,
  formatGhs,
  MYTURN_SHARE_PERCENTAGE,
  PayoutMode,
  RECOMMENDED_SERVICE_MARGIN_BPS,
} from "@myturn/shared";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";
import { GroupFinancePreviewCard } from "@/components/admin/GroupFinancePreviewCard";
import { ServiceMarginSelector } from "@/components/admin/ServiceMarginSelector";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const inputClass = cn(
  "mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900",
  "outline-none ring-brand-green/20 focus:border-brand-green focus:ring-2",
);

export default function CreateGroupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [contributionAmount, setContributionAmount] = useState("100");
  const [groupSize, setGroupSize] = useState("5");
  const [payoutMode, setPayoutMode] = useState<PayoutMode>(PayoutMode.CYCLE);
  const [daysPerCycle, setDaysPerCycle] = useState("1");
  const [startDate, setStartDate] = useState(todayIso);
  const [serviceMarginBps, setServiceMarginBps] = useState(
    RECOMMENDED_SERVICE_MARGIN_BPS,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const contributionNum = Number(contributionAmount);
  const groupSizeNum = Number(groupSize);
  const daysPerCycleNum = Number(daysPerCycle);

  const previewResult = useMemo(() => {
    if (payoutMode === PayoutMode.CYCLE) {
      if (!Number.isFinite(daysPerCycleNum) || !Number.isInteger(daysPerCycleNum)) {
        return {
          ok: false as const,
          reason: "Enter a valid whole number of days per cycle",
        };
      }
    }
    if (!Number.isFinite(contributionNum) || !Number.isFinite(groupSizeNum)) {
      return { ok: false as const, reason: "Enter valid contribution and group size" };
    }
    return computeGroupFinancePreview({
      contributionAmount: contributionNum,
      groupSize: groupSizeNum,
      payoutMode,
      daysPerCycle:
        payoutMode === PayoutMode.CYCLE ? daysPerCycleNum : undefined,
      startDate,
      serviceMarginBps,
    });
  }, [
    contributionAmount,
    groupSize,
    daysPerCycle,
    payoutMode,
    startDate,
    serviceMarginBps,
    contributionNum,
    groupSizeNum,
    daysPerCycleNum,
  ]);

  const preview = previewResult.ok ? previewResult.preview : null;

  const contributionLabel =
    payoutMode === PayoutMode.DAILY
      ? "Contribution (per member / cycle)"
      : "Contribution (per day)";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!previewResult.ok) {
      setError(previewResult.reason);
      return;
    }
    setPending(true);
    try {
      await apiFetch("/groups", {
        method: "POST",
        body: JSON.stringify({
          name,
          description: description || undefined,
          contributionAmount: contributionNum,
          groupSize: groupSizeNum,
          payoutMode,
          daysPerCycle:
            payoutMode === PayoutMode.CYCLE ? daysPerCycleNum : undefined,
          startDate,
          serviceMarginBps: previewResult.preview.serviceMarginBps,
        }),
      });
      router.push("/admin/groups");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-600">
          Amounts in GHS. Choose a service margin within the allowed range for
          your pool size. Margin split is fixed at {ADMIN_SHARE_PERCENTAGE}% admin
          / {MYTURN_SHARE_PERCENTAGE}% MyTurn HQ.
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-6 space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-card sm:p-6"
        >
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Name
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Description
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Payout model
            </label>
            <select
              value={payoutMode}
              onChange={(e) => setPayoutMode(e.target.value as PayoutMode)}
              className={inputClass}
            >
              <option value={PayoutMode.DAILY}>
                Daily (one payment per member per cycle)
              </option>
              <option value={PayoutMode.CYCLE}>
                Cycle (members pay every day for N days)
              </option>
            </select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {payoutMode === PayoutMode.DAILY
                  ? "Contribution per member / cycle (GHS)"
                  : "Contribution per day (GHS)"}
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={contributionAmount}
                onChange={(e) => setContributionAmount(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Group size (members)
              </label>
              <input
                type="number"
                min={5}
                max={250}
                required
                value={groupSize}
                onChange={(e) => setGroupSize(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          {payoutMode === PayoutMode.CYCLE && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Days per cycle
              </label>
              <input
                type="number"
                min={1}
                max={366}
                step={1}
                required
                value={daysPerCycle}
                onChange={(e) => setDaysPerCycle(e.target.value)}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-gray-500">
                Members contribute daily for this number of days before each
                payout.
              </p>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Start date
            </label>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputClass}
            />
          </div>

          {Number.isFinite(groupSizeNum) &&
            groupSizeNum > 100 &&
            Number.isFinite(contributionNum) && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Large groups may take longer to complete and require stronger
                trust management.
              </p>
            )}

          {Number.isFinite(contributionNum) &&
            Number.isFinite(groupSizeNum) &&
            groupSizeNum >= 5 && (
              <ServiceMarginSelector
                contributionAmount={contributionNum}
                groupSize={groupSizeNum}
                payoutMode={payoutMode}
                daysPerCycle={
                  payoutMode === PayoutMode.CYCLE ? daysPerCycleNum : undefined
                }
                startDate={startDate}
                serviceMarginBps={serviceMarginBps}
                onMarginBpsChange={setServiceMarginBps}
              />
            )}

          {!previewResult.ok && (
            <p className="text-sm font-medium text-amber-800">
              {previewResult.reason}
            </p>
          )}

          {error && (
            <p className="text-sm font-medium text-red-600">{error}</p>
          )}
          <button
            type="submit"
            disabled={pending || !previewResult.ok}
            className="w-full min-h-[48px] rounded-xl bg-brand-green py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-brand-green-dark disabled:opacity-50"
          >
            {pending ? "Saving…" : "Create draft group"}
          </button>
        </form>
      </div>

      <aside className="w-full shrink-0 lg:sticky lg:top-24 lg:w-[380px]">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-card-md sm:p-6">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Live preview
          </h2>
          <p className="mt-1 text-xs text-gray-600">
            Updates as you change contribution, size, payout model, or margin.
          </p>

          {preview ? (
            <GroupFinancePreviewCard
              preview={preview}
              contributionDisplay={formatGhs(contributionNum)}
              groupSize={groupSize}
              startDate={startDate}
            />
          ) : (
            <p className="mt-4 text-sm text-gray-500">
              Adjust the form to see the financial breakdown.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
