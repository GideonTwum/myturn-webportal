"use client";

import useSWR from "swr";
import { useState } from "react";
import { getMyturnApi } from "@/lib/myturn-api";
import { swrFetcher } from "@/lib/swr";
import type { WithdrawalsListResponse } from "@myturn/api-client";

export default function HqWithdrawalsPage() {
  const { data, mutate } = useSWR<WithdrawalsListResponse>(
    "/hq/withdrawals",
    swrFetcher,
  );
  const [providerRef, setProviderRef] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const rows = data?.withdrawals ?? [];

  async function manualOverride(id: string) {
    const ref = providerRef[id]?.trim();
    if (!ref) {
      setMsg("MoMo reference required for manual override");
      return;
    }
    await getMyturnApi().wallet.hqConfirmWithdrawal(id, {
      providerRef: ref,
      provider: "manual-override",
    });
    setMsg("Manual override applied.");
    void mutate();
  }

  async function failStuck(id: string) {
    await getMyturnApi().wallet.hqFailWithdrawal(id, {
      reason: "Could not complete MoMo transfer — HQ exception",
    });
    setMsg("Stuck withdrawal marked as failed.");
    void mutate();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">Withdrawal oversight</h1>
      <p className="text-sm text-gray-600">
        All withdrawals are <span className="font-medium">automatic</span> via MTN
        disbursement (members and admin earnings). HQ monitors status and handles
        exceptions only — fail stuck withdrawals or apply a manual override when a
        provider callback was missed.
      </p>
      {msg ? <p className="text-sm text-green-700">{msg}</p> : null}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-2">Actor</th>
              <th className="px-4 py-2">Mode</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">MoMo</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Reference</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const stuck = r.status === "PROCESSING";
              const needsAttention = r.isStale || (stuck && r.canManualOverride);
              return (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2 font-medium text-gray-900">
                    {r.actorName ?? "User"}
                    <span className="ml-2 text-xs text-gray-500">{r.actorRole}</span>
                    {r.isStale ? (
                      <span className="ml-2 text-xs font-semibold text-amber-700">
                        Stuck / Needs attention
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2">Automatic</td>
                  <td className="px-4 py-2">GHS {r.amount}</td>
                  <td className="px-4 py-2">{r.momoNumber}</td>
                  <td className="px-4 py-2">{r.status}</td>
                  <td className="px-4 py-2">
                    {r.canManualOverride ? (
                      <input
                        className="w-40 rounded border px-2 py-1 text-xs"
                        placeholder="MoMo ref (override)"
                        value={providerRef[r.id] ?? ""}
                        onChange={(e) =>
                          setProviderRef((prev) => ({
                            ...prev,
                            [r.id]: e.target.value,
                          }))
                        }
                      />
                    ) : (
                      <span className="font-mono text-xs">{r.providerRef ?? "—"}</span>
                    )}
                  </td>
                  <td className="space-x-2 px-4 py-2">
                    {r.canManualOverride ? (
                      <button
                        type="button"
                        className="text-xs font-medium text-brand-green"
                        onClick={() => void manualOverride(r.id)}
                      >
                        Manual override
                      </button>
                    ) : null}
                    {stuck && r.canManage ? (
                      <button
                        type="button"
                        className="text-xs text-red-600"
                        onClick={() => void failStuck(r.id)}
                      >
                        Fail stuck
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="p-6 text-center text-gray-500">No withdrawal requests.</p>
        ) : null}
      </div>
    </div>
  );
}
