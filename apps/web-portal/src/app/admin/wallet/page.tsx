"use client";

import useSWR from "swr";
import Link from "next/link";
import { useState } from "react";
import { Wallet } from "lucide-react";
import { getMyturnApi } from "@/lib/myturn-api";
import { swrFetcher, LIVE_POLL_MS } from "@/lib/swr";
import type { WalletSummary, WithdrawalsListResponse } from "@myturn/api-client";

export default function AdminWalletPage() {
  const { data, isLoading, mutate } = useSWR<WalletSummary>(
    "/admin/wallet",
    swrFetcher,
    { refreshInterval: LIVE_POLL_MS },
  );
  const { data: withdrawals } = useSWR<WithdrawalsListResponse>(
    "/admin/withdrawals",
    swrFetcher,
    { refreshInterval: LIVE_POLL_MS },
  );
  const [amount, setAmount] = useState("");
  const [momo, setMomo] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function requestWithdrawal() {
    setMsg(null);
    setErr(null);
    try {
      await getMyturnApi().wallet.adminCreateWithdrawal({
        amount: amount.trim(),
        momoNumber: momo.trim(),
      });
      setMsg("Withdrawal requested — HQ will process manually.");
      setAmount("");
      void mutate();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Wallet className="h-8 w-8 text-brand-green" />
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Earnings wallet</h1>
          <p className="text-sm text-gray-600">
            Admin share (60% of service margin). Withdrawals require HQ confirmation.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        {isLoading ? (
          <p className="text-gray-500">Loading…</p>
        ) : (
          <>
            <p className="text-sm text-gray-500">Available balance</p>
            <p className="text-3xl font-bold text-gray-900">
              GHS {data?.availableBalance ?? "0.00"}
            </p>
            <p className="mt-2 text-sm text-gray-600">
              Total earnings recorded: GHS {data?.totalEarningsRecorded ?? "0.00"} · Pending
              withdrawals: GHS {data?.pendingWithdrawals ?? "0.00"} · Withdrawn: GHS{" "}
              {data?.totalWithdrawn ?? "0.00"}
            </p>
          </>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-gray-900">Request withdrawal</h2>
        <p className="mb-4 text-sm text-gray-600">Manual MoMo disbursement during beta.</p>
        <input
          className="mb-2 w-full rounded-lg border px-3 py-2 text-sm"
          placeholder="Amount (GHS)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <input
          className="mb-3 w-full rounded-lg border px-3 py-2 text-sm"
          placeholder="MoMo number"
          value={momo}
          onChange={(e) => setMomo(e.target.value)}
        />
        <button
          type="button"
          onClick={() => void requestWithdrawal()}
          className="rounded-lg bg-brand-green px-4 py-2 text-sm font-medium text-white"
        >
          Submit request
        </button>
        {msg ? <p className="mt-3 text-sm text-green-700">{msg}</p> : null}
        {err ? <p className="mt-3 text-sm text-red-600">{err}</p> : null}
        <p className="mt-4 text-sm">
          <Link href="/admin/withdrawals" className="font-medium text-brand-green">
            View withdrawal history →
          </Link>
        </p>
      </div>

      {(withdrawals?.withdrawals.length ?? 0) > 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900">Recent withdrawals</h2>
          <ul className="mt-3 space-y-2 text-sm text-gray-700">
            {(withdrawals?.withdrawals ?? []).slice(0, 5).map((w) => (
              <li key={w.id} className="flex justify-between border-b border-gray-100 py-2">
                <span>
                  GHS {w.amount} · {w.status}
                </span>
                <span className="text-gray-500">
                  {new Date(w.requestedAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
