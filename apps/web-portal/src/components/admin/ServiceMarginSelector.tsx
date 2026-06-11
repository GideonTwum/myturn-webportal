"use client";

import { useEffect, useMemo } from "react";
import {
  bpsToPercentage,
  clampServiceMarginBps,
  computeGrossPoolMinorFromParams,
  computeGroupFinancePreview,
  formatGhs,
  PayoutMode,
  RECOMMENDED_SERVICE_MARGIN_BPS,
  type PayoutModeLiteral,
} from "@myturn/shared";
import { cn } from "@/lib/cn";

type Props = {
  contributionAmount: number;
  groupSize: number;
  payoutMode: PayoutModeLiteral;
  daysPerCycle?: number;
  startDate: string;
  serviceMarginBps: number;
  onMarginBpsChange: (bps: number) => void;
  disabled?: boolean;
};

const inputClass = cn(
  "mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900",
  "outline-none ring-brand-green/20 focus:border-brand-green focus:ring-2",
);

export function ServiceMarginSelector({
  contributionAmount,
  groupSize,
  payoutMode,
  daysPerCycle,
  startDate,
  serviceMarginBps,
  onMarginBpsChange,
  disabled,
}: Props) {
  const previewResult = useMemo(
    () =>
      computeGroupFinancePreview({
        contributionAmount,
        groupSize,
        payoutMode,
        daysPerCycle:
          payoutMode === PayoutMode.CYCLE ? daysPerCycle : undefined,
        startDate,
        serviceMarginBps,
      }),
    [
      contributionAmount,
      groupSize,
      payoutMode,
      daysPerCycle,
      startDate,
      serviceMarginBps,
    ],
  );

  const bounds = previewResult.ok
    ? {
        min: previewResult.preview.minAllowedMarginBps,
        max: previewResult.preview.maxAllowedMarginBps,
        recommended: previewResult.preview.recommendedMarginBps,
        gross: previewResult.preview.totalCollectedPerCycle,
      }
    : null;

  const percentOptions = useMemo(() => {
    if (!bounds) return [];
    const opts: number[] = [];
    for (let bps = bounds.min; bps <= bounds.max; bps += 100) {
      opts.push(bps);
    }
    return opts;
  }, [bounds]);

  useEffect(() => {
    if (!bounds || disabled) return;
    const grossMinor = computeGrossPoolMinorFromParams(
      contributionAmount,
      groupSize,
      payoutMode,
      payoutMode === PayoutMode.CYCLE ? daysPerCycle : undefined,
    );
    const clamped = clampServiceMarginBps(serviceMarginBps, grossMinor);
    if (clamped !== serviceMarginBps) {
      onMarginBpsChange(clamped);
    }
  }, [
    bounds,
    serviceMarginBps,
    onMarginBpsChange,
    disabled,
    contributionAmount,
    groupSize,
    payoutMode,
    daysPerCycle,
  ]);

  if (!bounds) {
    return (
      <p className="text-sm text-amber-800">
        {previewResult.ok ? "" : previewResult.reason}
      </p>
    );
  }

  const recommendedLabel =
    bounds.recommended === RECOMMENDED_SERVICE_MARGIN_BPS
      ? "Recommended by MyTurn: 10%"
      : `Recommended by MyTurn: ${bpsToPercentage(bounds.recommended)}% (max for this pool)`;

  return (
    <div className="rounded-2xl border border-brand-green/30 bg-brand-green/5 px-4 py-4">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
        Service margin
      </p>
      <p className="mt-2 text-sm text-gray-700">
        Pool size (gross per cycle):{" "}
        <span className="font-semibold text-gray-900">
          {formatGhs(bounds.gross)}
        </span>
      </p>
      <p className="mt-1 text-sm text-gray-600">
        Allowed margin range:{" "}
        <span className="font-semibold">
          {bpsToPercentage(bounds.min)}% – {bpsToPercentage(bounds.max)}%
        </span>
      </p>
      <p className="mt-1 text-xs text-brand-green-dark">{recommendedLabel}</p>
      <p className="mt-0.5 text-xs text-gray-500">
        Service margin revenue goes 100% to MyTurn (admins are platform operators).
      </p>

      <div className="mt-4">
        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Selected margin
        </label>
        <select
          value={serviceMarginBps}
          disabled={disabled}
          onChange={(e) => onMarginBpsChange(Number(e.target.value))}
          className={inputClass}
        >
          {percentOptions.map((bps) => (
            <option key={bps} value={bps}>
              {bpsToPercentage(bps)}%
              {bps === bounds.recommended ? " (recommended)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        <label className="flex justify-between text-xs font-semibold text-gray-500">
          <span>Adjust margin</span>
          <span className="text-brand-green-dark">
            {bpsToPercentage(serviceMarginBps)}%
          </span>
        </label>
        <input
          type="range"
          min={bounds.min}
          max={bounds.max}
          step={100}
          disabled={disabled}
          value={serviceMarginBps}
          onChange={(e) => onMarginBpsChange(Number(e.target.value))}
          className="mt-2 w-full accent-brand-green"
        />
      </div>
    </div>
  );
}
