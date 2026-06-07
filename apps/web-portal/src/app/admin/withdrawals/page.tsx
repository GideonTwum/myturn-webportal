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
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <ArrowLeftRight className="h-8 w-8 text-brand-green" />
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Withdrawal history</h1>
          <p className="text-sm text-gray-600">
            Manual MoMo disbursements during beta.{" "}
            <Link href="/admin/wallet" className="text-brand-green font-medium">
              Request a withdrawal
            </Link>
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
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
                <td className="px-4 py-2 font-medium">{formatGhs(Number(r.amount))}</td>
                <td className="px-4 py-2">{r.momoNumber}</td>
                <td className="px-4 py-2">{r.status}</td>
                <td className="px-4 py-2">
                  {new Date(r.requestedAt).toLocaleString()}
                </td>
                <td className="px-4 py-2 font-mono text-xs">{r.providerRef ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && rows.length === 0 ? (
          <p className="p-6 text-center text-gray-500">No withdrawals yet.</p>
        ) : null}
      </div>
    </div>
  );
}
