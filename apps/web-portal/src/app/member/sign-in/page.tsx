"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { AuthUser } from "@/lib/auth-context";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/cn";

const inputClass = cn(
  "mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900",
  "outline-none ring-brand-green/20 focus:border-brand-green focus:ring-2",
);

export default function MemberSignInPage() {
  const router = useRouter();
  const { applyMemberSession } = useAuth();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = phone.trim();
    if (!trimmed) {
      setError("Enter your phone number");
      return;
    }
    setPending(true);
    try {
      const res = await apiFetch<{
        access_token: string;
        user: AuthUser;
      }>("/auth/member-phone", {
        method: "POST",
        body: JSON.stringify({ phone: trimmed }),
      });
      applyMemberSession(res.access_token, res.user);
      router.replace("/member");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not sign in. Use the same phone you used to join.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-card">
      <h1 className="text-xl font-bold text-gray-900">Member sign-in</h1>
      <p className="mt-2 text-sm text-gray-600">
        Temporary web access — enter the phone number you used when joining
        your group.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Phone
          </label>
          <input
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
            autoComplete="tel"
            inputMode="tel"
            placeholder="e.g. 0240000000"
          />
        </div>
        {error && (
          <p className="text-sm font-medium text-red-600">{error}</p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full min-h-[48px] rounded-xl bg-brand-green py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-brand-green-dark disabled:opacity-50"
        >
          {pending ? "Signing in…" : "Continue"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-500">
        New here?{" "}
        <Link href="/join" className="font-medium text-brand-green hover:underline">
          Join with an invite code
        </Link>
      </p>
    </div>
  );
}
