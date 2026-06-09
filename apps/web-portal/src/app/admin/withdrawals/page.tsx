"use client";

import useSWR from "swr";
import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import { formatGhs } from "@myturn/shared";
import { swrFetcher, LIVE_POLL_MS } from "@/lib/swr";
import type { WithdrawalsListResponse } from "@myturn/api-client";

export default function AdminWithdrawalsPage() {
  const { data, isLoading } = useSWR<WithdrawalsListResponse>(
    "/admin/withdrawals",
    swrFetcher,
    { refreshInterval: LIVE_POLL_MS },
  );

  const rows = data?.withdrawals ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <ArrowLeftRight className="h-8 w-8 text-brand-green" />
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Member withdrawals</h1>
          <p className="text-sm text-gray-600">
            Monitor automatic MoMo withdrawals for members in your groups. You do
            not approve these — the system sends MoMo directly.{" "}
            <Link href="/admin/wallet" className="font-medium text-brand-green">
              Your earnings withdrawals
            </Link>{" "}
            are automatic via MoMo.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-2">Member</th>
              <th className="px-4 py-2">Mode</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">MoMo</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Requested</th>
              <th className="px-4 py-2">Reference</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2 font-medium text-gray-900">
                  {r.actorName ?? "Member"}
                  {r.actorRole === "ADMIN" ? (
                    <span className="ml-2 text-xs font-semibold uppercase text-gray-500">
                      You
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-2 text-gray-600">
                  Automatic
                </td>
                <td className="px-4 py-2">{formatGhs(Number(r.amount))}</td>
                <td className="px-4 py-2">{r.momoNumber}</td>
                <td className="px-4 py-2">{r.status}</td>
                <td className="px-4 py-2">
                  {new Date(r.requestedAt).toLocaleString()}
                </td>
                <td className="px-4 py-2 font-mono text-xs">
                  {r.providerRef ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && rows.length === 0 ? (
          <p className="p-6 text-center text-gray-500">No withdrawal requests.</p>
        ) : null}
      </div>
    </div>
  );
}
