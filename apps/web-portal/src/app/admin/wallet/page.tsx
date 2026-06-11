"use client";

import Link from "next/link";

/** @deprecated Admin earnings wallet removed. */
export default function AdminWalletDeprecatedPage() {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
      <h1 className="text-xl font-semibold text-amber-950">Earnings wallet removed</h1>
      <p className="mt-3 text-sm text-amber-900">
        Admin earnings wallets are deprecated. Admins are platform operators who
        work on behalf of MyTurn. Compensation is managed separately by MyTurn
        operations.
      </p>
      <p className="mt-4 text-sm">
        <Link href="/admin" className="font-medium text-brand-green">
          ← Back to dashboard
        </Link>
      </p>
    </div>
  );
}
