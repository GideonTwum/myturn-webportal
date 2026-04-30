"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { AuthUser } from "@/lib/auth-context";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/cn";

const inputClass = cn(
  "mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900",
  "outline-none ring-brand-green/20 focus:border-brand-green focus:ring-2",
);

type InvitePreview = {
  name: string;
  contributionAmount: string;
  payoutMode: "DAILY" | "CYCLE";
  daysPerCycle?: number;
  requiredDepositAmount?: string;
  depositHelp?: string;
  daysPerCycleHelp: string;
  groupSize: number;
  currentMembers: number;
  availableSlots: number;
};

type JoinResponse = {
  message: string;
  access_token: string;
  user: AuthUser;
};

export default function JoinGroupPage() {
  const router = useRouter();
  const { applyMemberSession } = useAuth();
  const [step, setStep] = useState<"code" | "form">("code");
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onLookup(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Enter an invite code");
      return;
    }
    setPending(true);
    try {
      const p = await apiFetch<InvitePreview>(
        `/groups/invite/${encodeURIComponent(trimmed)}`,
      );
      setPreview(p);
      setStep("form");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setPending(false);
    }
  }

  async function onJoin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!preview) return;
    setPending(true);
    try {
      const res = await apiFetch<JoinResponse>("/groups/join", {
        method: "POST",
        body: JSON.stringify({
          inviteCode: code.trim().toUpperCase(),
          fullName,
          phone,
        }),
      });
      applyMemberSession(res.access_token, res.user);
      router.replace("/member");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Join failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900">Join a group</h1>
      <p className="mt-2 text-sm text-gray-600">
        Enter the invite code your group admin shared with you.
      </p>

      {step === "code" && (
        <form
          onSubmit={onLookup}
          className="mt-8 space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-card"
        >
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Invite code
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="MT-XXXX"
              className={inputClass}
              autoComplete="off"
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
            {pending ? "Checking…" : "Continue"}
          </button>
        </form>
      )}

      {step === "form" && preview && (
        <div className="mt-8 space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-card">
            <h2 className="text-lg font-semibold text-gray-900">
              {preview.name}
            </h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">Payout model</dt>
                <dd className="font-medium text-gray-900">
                  {preview.payoutMode === "DAILY"
                    ? "Daily (one pay / member)"
                    : "Multi-day cycle"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">
                  {preview.payoutMode === "DAILY"
                    ? "Contribution / member / cycle"
                    : "Contribution / day"}
                </dt>
                <dd className="font-medium text-gray-900">
                  GHS {preview.contributionAmount}
                </dd>
              </div>
              {preview.payoutMode === "CYCLE" &&
                preview.requiredDepositAmount != null && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500">Security deposit (locked)</dt>
                    <dd className="font-medium text-gray-900">
                      GHS {preview.requiredDepositAmount}
                    </dd>
                  </div>
                )}
              {preview.payoutMode === "CYCLE" &&
                preview.daysPerCycle != null && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500">Days per cycle</dt>
                    <dd className="text-gray-900">{preview.daysPerCycle}</dd>
                  </div>
                )}
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">Members</dt>
                <dd className="text-gray-900">
                  {preview.currentMembers} / {preview.groupSize} (
                  {preview.availableSlots} slots open)
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-gray-500">
              {preview.daysPerCycleHelp}
            </p>
            {preview.depositHelp && (
              <p className="mt-1 text-xs text-amber-900/90">{preview.depositHelp}</p>
            )}
            <button
              type="button"
              onClick={() => {
                setStep("code");
                setPreview(null);
                setError(null);
              }}
              className="mt-4 text-sm font-medium text-brand-green hover:underline"
            >
              Use a different code
            </button>
          </div>

          <form
            onSubmit={onJoin}
            className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-card"
          >
            <p className="text-sm text-gray-600">
              Enter your details to join. If you already have a member account,
              sign in first so we can link this group.
            </p>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Full name
              </label>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputClass}
                autoComplete="name"
              />
            </div>
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
              {pending ? "Joining…" : "Join group"}
            </button>
          </form>
        </div>
      )}

      <p className="mt-8 flex flex-col items-center gap-2 text-center text-sm text-gray-500 sm:flex-row sm:justify-center">
        <Link href="/member/sign-in" className="font-medium text-brand-green hover:underline">
          Member sign-in
        </Link>
        <span className="hidden sm:inline">·</span>
        <Link href="/login" className="font-medium text-brand-green hover:underline">
          Admin / HQ login
        </Link>
      </p>
    </div>
  );
}
