"use client";

import useSWR from "swr";
import Link from "next/link";
import { formatGhs } from "@myturn/shared";
import { swrFetcher } from "@/lib/swr";

type EarningRow = {
  id: string;
  groupId: string;
  cycleNumber: number;
  marginAmount: string;
  adminShareAmount: string;
  platformShareAmount: string;
  settledAt: string;
  group?: { name: string };
};

type EarningsResponse = { earnings: EarningRow[] };

/** Legacy margin records — admin share no longer allocated. */
export default function AdminEarningsLegacyPage() {
  const { data, isLoading } = useSWR<EarningsResponse>(
    "/admin-earnings/mine",
    swrFetcher,
  );
  const rows = data?.earnings ?? [];
  const hasLegacy = rows.some((r) => Number(r.adminShareAmount) > 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Legacy earnings data</h1>
        <p className="mt-2 text-sm text-gray-600">
          Admin margin share is deprecated. Service margin is now 100% MyTurn
          revenue. Historical records below are read-only.
        </p>
      </div>

      {!hasLegacy && !isLoading ? (
        <p className="rounded-xl border bg-white p-6 text-sm text-gray-600">
          No legacy admin earnings on record.{" "}
          <Link href="/admin" className="font-medium text-brand-green">
            Return to dashboard
          </Link>
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-2">Group</th>
                <th className="px-4 py-2">Cycle</th>
                <th className="px-4 py-2">Margin</th>
                <th className="px-4 py-2">Legacy admin share</th>
                <th className="px-4 py-2">MyTurn share</th>
                <th className="px-4 py-2">Settled</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2">{r.group?.name ?? r.groupId}</td>
                  <td className="px-4 py-2">{r.cycleNumber}</td>
                  <td className="px-4 py-2">{formatGhs(Number(r.marginAmount))}</td>
                  <td className="px-4 py-2">{formatGhs(Number(r.adminShareAmount))}</td>
                  <td className="px-4 py-2">{formatGhs(Number(r.platformShareAmount))}</td>
                  <td className="px-4 py-2">
                    {new Date(r.settledAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
