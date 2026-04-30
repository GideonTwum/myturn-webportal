"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import {
  ADMIN_SHARE_PERCENTAGE,
  computeGroupFinancePreview,
  formatGhs,
  MYTURN_SHARE_PERCENTAGE,
  PayoutMode,
  SERVICE_MARGIN_PERCENTAGE,
} from "@myturn/shared";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";

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
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const previewResult = useMemo(() => {
    const c = Number(contributionAmount);
    const g = Number(groupSize);
    const dpc = Number(daysPerCycle);
    if (payoutMode === PayoutMode.CYCLE) {
      if (!Number.isFinite(dpc) || !Number.isInteger(dpc)) {
        return {
          ok: false as const,
          reason: "Enter a valid whole number of days per cycle",
        };
      }
    }
    return computeGroupFinancePreview({
      contributionAmount: c,
      groupSize: g,
      payoutMode,
      daysPerCycle:
        payoutMode === PayoutMode.CYCLE ? dpc : undefined,
      startDate,
    });
  }, [contributionAmount, groupSize, daysPerCycle, payoutMode, startDate]);

  const preview = previewResult.ok ? previewResult.preview : null;

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
          contributionAmount: Number(contributionAmount),
          groupSize: Number(groupSize),
          payoutMode,
          daysPerCycle:
            payoutMode === PayoutMode.CYCLE
              ? Number(daysPerCycle)
              : undefined,
          startDate,
        }),
      });
      router.push("/admin/groups");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setPending(false);
    }
  }

  const groupSizeNum = Number(groupSize);

  const schedulePreview =
    preview && preview.payoutSchedule.length > 8
      ? [
          ...preview.payoutSchedule.slice(0, 4),
          ...preview.payoutSchedule.slice(-2),
        ]
      : preview?.payoutSchedule ?? [];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-600">
          Amounts in GHS. Revenue rules are fixed for MVP and match settlement
          exactly (not editable in the portal).
        </p>
        <div className="mt-4 rounded-xl border border-amber-200/80 bg-brand-gold-soft/50 px-4 py-3 text-sm text-amber-950">
          Service margin {SERVICE_MARGIN_PERCENTAGE}% of cycle gross; margin
          split {ADMIN_SHARE_PERCENTAGE}% admin / {MYTURN_SHARE_PERCENTAGE}{" "}
          MyTurn — defined in platform code.
        </div>

        <div className="mt-4 rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-card">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Revenue rules (read-only, MVP)
          </p>
          <ul className="mt-3 grid gap-2 text-sm text-gray-800 sm:grid-cols-3">
            <li>
              Service margin:{" "}
              <span className="font-semibold">
                {SERVICE_MARGIN_PERCENTAGE}%
              </span>
            </li>
            <li>
              Admin split:{" "}
              <span className="font-semibold text-brand-gold-dark">
                {ADMIN_SHARE_PERCENTAGE}%
              </span>
            </li>
            <li>
              MyTurn split:{" "}
              <span className="font-semibold text-blue-700">
                {MYTURN_SHARE_PERCENTAGE}%
              </span>
            </li>
          </ul>
        </div>

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
              onChange={(e) =>
                setPayoutMode(e.target.value as PayoutMode)
              }
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

          {Number.isFinite(groupSizeNum) && groupSizeNum > 100 && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Large groups may take longer to complete and require stronger trust
              management.
            </p>
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
            Same formulas as payout settlement (fixed MVP rules in code).
          </p>

          {preview ? (
            <>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-2 border-b border-gray-100 pb-2">
                  <dt className="text-gray-500">Payout model</dt>
                  <dd className="font-medium text-gray-900">
                    {preview.payoutMode === PayoutMode.DAILY
                      ? "Daily (one pay / member)"
                      : "Multi-day cycle"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 border-b border-gray-100 pb-2">
                  <dt className="text-gray-500">
                    {preview.payoutMode === PayoutMode.DAILY
                      ? "Contribution / member / cycle"
                      : "Contribution / day"}
                  </dt>
                  <dd className="font-medium text-gray-900">
                    {formatGhs(Number(contributionAmount))}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 border-b border-gray-100 pb-2">
                  <dt className="text-gray-500">Calendar days / cycle</dt>
                  <dd className="text-gray-900">{preview.daysPerCycle}</dd>
                </div>
                <div className="flex justify-between gap-2 border-b border-gray-100 pb-2">
                  <dt className="text-gray-500">Group size</dt>
                  <dd className="text-gray-900">{groupSize}</dd>
                </div>
                <div className="flex justify-between gap-2 border-b border-gray-100 pb-2">
                  <dt className="text-gray-500">Total collected / cycle</dt>
                  <dd className="font-semibold text-gray-900">
                    {formatGhs(preview.totalCollectedPerCycle)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 border-b border-gray-100 pb-2">
                  <dt className="text-gray-500">Service margin / cycle</dt>
                  <dd className="text-gray-700">
                    {formatGhs(preview.serviceMarginPerCycle)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 border-b border-gray-100 pb-2">
                  <dt className="text-gray-500">Payout / cycle</dt>
                  <dd className="font-bold text-brand-green">
                    {formatGhs(preview.payoutAmountPerCycle)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 border-b border-gray-100 pb-2">
                  <dt className="text-gray-500">Admin earnings / cycle</dt>
                  <dd className="font-semibold text-brand-gold-dark">
                    {formatGhs(preview.adminEarningPerCycle)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 border-b border-gray-100 pb-2">
                  <dt className="text-gray-500">MyTurn earnings / cycle</dt>
                  <dd className="font-semibold text-blue-700">
                    {formatGhs(preview.myTurnEarningPerCycle)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 border-b border-gray-100 pb-2">
                  <dt className="text-gray-500">Total admin earnings</dt>
                  <dd className="font-semibold text-brand-gold-dark">
                    {formatGhs(preview.totalAdminEarnings)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 border-b border-gray-100 pb-2">
                  <dt className="text-gray-500">Total MyTurn earnings</dt>
                  <dd className="font-semibold text-blue-700">
                    {formatGhs(preview.totalMyTurnEarnings)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2 border-b border-gray-100 pb-2">
                  <dt className="text-gray-500">Total cycles</dt>
                  <dd className="text-gray-900">{preview.totalCycles}</dd>
                </div>
                <div className="flex justify-between gap-2 border-b border-gray-100 pb-2">
                  <dt className="text-gray-500">Start date</dt>
                  <dd className="text-right text-gray-900">{startDate}</dd>
                </div>
                <div className="flex justify-between gap-2 pb-2">
                  <dt className="text-gray-500">Estimated end date</dt>
                  <dd className="text-right text-gray-900">{preview.endDate}</dd>
                </div>
              </dl>
              <div className="mt-4 border-t border-gray-100 pt-3">
                <p className="text-xs font-semibold text-gray-500">
                  Payout schedule (by cycle)
                </p>
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-gray-600">
                  {preview.payoutSchedule.length > 8 ? (
                    <>
                      {schedulePreview.slice(0, 4).map((row) => (
                        <li key={row.cycle} className="flex justify-between">
                          <span>Cycle {row.cycle}</span>
                          <span className="text-gray-800">{row.payoutDate}</span>
                        </li>
                      ))}
                      <li className="py-1 text-center text-gray-400">…</li>
                      {schedulePreview.slice(-2).map((row) => (
                        <li key={row.cycle} className="flex justify-between">
                          <span>Cycle {row.cycle}</span>
                          <span className="text-gray-800">{row.payoutDate}</span>
                        </li>
                      ))}
                    </>
                  ) : (
                    preview.payoutSchedule.map((row) => (
                      <li key={row.cycle} className="flex justify-between">
                        <span>Cycle {row.cycle}</span>
                        <span className="text-gray-800">{row.payoutDate}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </>
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
