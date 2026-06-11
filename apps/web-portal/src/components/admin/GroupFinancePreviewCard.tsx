"use client";

import { formatGhs, PayoutMode, type GroupFinancePreview } from "@myturn/shared";
import { bpsToPercentage } from "@myturn/shared";

type Props = {
  preview: GroupFinancePreview;
  contributionDisplay: string;
  groupSize: string | number;
  startDate: string;
};

export function GroupFinancePreviewCard({
  preview,
  contributionDisplay,
  groupSize,
  startDate,
}: Props) {
  const schedulePreview =
    preview.payoutSchedule.length > 8
      ? [
          ...preview.payoutSchedule.slice(0, 4),
          ...preview.payoutSchedule.slice(-2),
        ]
      : preview.payoutSchedule;

  return (
    <dl className="mt-4 space-y-3 text-sm">
      <div className="flex justify-between gap-2 border-b border-gray-100 pb-2">
        <dt className="text-gray-500">Gross pool / cycle</dt>
        <dd className="font-semibold text-gray-900">
          {formatGhs(preview.totalCollectedPerCycle)}
        </dd>
      </div>
      <div className="flex justify-between gap-2 border-b border-gray-100 pb-2">
        <dt className="text-gray-500">Allowed margin</dt>
        <dd className="text-gray-900">
          {bpsToPercentage(preview.minAllowedMarginBps)}% –{" "}
          {bpsToPercentage(preview.maxAllowedMarginBps)}%
        </dd>
      </div>
      <div className="flex justify-between gap-2 border-b border-gray-100 pb-2">
        <dt className="text-gray-500">Selected margin</dt>
        <dd className="font-semibold text-brand-green-dark">
          {bpsToPercentage(preview.serviceMarginBps)}%
        </dd>
      </div>
      <div className="flex justify-between gap-2 border-b border-gray-100 pb-2">
        <dt className="text-gray-500">Payout model</dt>
        <dd className="font-medium text-gray-900">
          {preview.payoutMode === PayoutMode.DAILY
            ? "Daily (one pay / member)"
            : "Multi-day cycle"}
        </dd>
      </div>
      <div className="flex justify-between gap-2 border-b border-gray-100 pb-2">
        <dt className="text-gray-500">Contribution</dt>
        <dd className="font-medium text-gray-900">{contributionDisplay}</dd>
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
        <dt className="text-gray-500">Service margin / cycle</dt>
        <dd className="text-gray-700">
          {formatGhs(preview.serviceMarginPerCycle)}
        </dd>
      </div>
      <div className="flex justify-between gap-2 border-b border-gray-100 pb-2">
        <dt className="text-gray-500">Net payout / cycle</dt>
        <dd className="font-bold text-brand-green">
          {formatGhs(preview.payoutAmountPerCycle)}
        </dd>
      </div>
      <div className="flex justify-between gap-2 border-b border-gray-100 pb-2">
        <dt className="text-gray-500">MyTurn revenue / cycle</dt>
        <dd className="font-semibold text-blue-700">
          {formatGhs(preview.myTurnEarningPerCycle)}
        </dd>
      </div>
      <div className="flex justify-between gap-2 border-b border-gray-100 pb-2">
        <dt className="text-gray-500">Total MyTurn revenue</dt>
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
    </dl>
  );
}
