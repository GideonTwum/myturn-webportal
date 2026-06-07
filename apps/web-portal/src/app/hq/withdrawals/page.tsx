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

  async function confirm(id: string) {
    const ref = providerRef[id]?.trim();
    if (!ref) {
      setMsg("MoMo reference required to confirm");
      return;
    }
    await getMyturnApi().wallet.hqConfirmWithdrawal(id, {
      providerRef: ref,
      provider: "manual",
    });
    setMsg(`Withdrawal ${id} confirmed`);
    void mutate();
  }

  async function fail(id: string) {
    await getMyturnApi().wallet.hqFailWithdrawal(id, {
      reason: "Could not complete MoMo transfer",
    });
    void mutate();
  }

  const rows = data?.withdrawals ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">Withdrawal operations</h1>
      <p className="text-sm text-gray-600">
        Confirm manual MoMo sends with a provider reference. Do not confirm without external proof.
      </p>
      {msg ? <p className="text-sm text-green-700">{msg}</p> : null}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-2">Actor</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">MoMo</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Reference</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2 font-mono text-xs">{r.actorId?.slice(0, 8) ?? r.id.slice(0, 8)}…</td>
                <td className="px-4 py-2">{r.actorRole ?? "—"}</td>
                <td className="px-4 py-2">GHS {r.amount}</td>
                <td className="px-4 py-2">{r.momoNumber}</td>
                <td className="px-4 py-2">{r.status}</td>
                <td className="px-4 py-2">
                  {r.status === "PENDING" || r.status === "PROCESSING" ? (
                    <input
                      className="w-40 rounded border px-2 py-1 text-xs"
                      placeholder="MoMo ref"
                      value={providerRef[r.id] ?? ""}
                      onChange={(e) =>
                        setProviderRef((prev) => ({ ...prev, [r.id]: e.target.value }))
                      }
                    />
                  ) : (
                    (r.providerRef ?? "—")
                  )}
                </td>
                <td className="px-4 py-2 space-x-2">
                  {r.status === "PENDING" || r.status === "PROCESSING" ? (
                    <>
                      <button
                        type="button"
                        className="text-brand-green text-xs font-medium"
                        onClick={() => void confirm(r.id)}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        className="text-red-600 text-xs"
                        onClick={() => void fail(r.id)}
                      >
                        Fail
                      </button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="p-6 text-center text-gray-500">No withdrawal requests.</p>
        ) : null}
      </div>
    </div>
  );
}
