"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { computeGroupFinancePreview, PayoutMode } from "@myturn/shared";
import { Copy, Pencil } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { LIVE_POLL_MS, useSWR, useSWRConfig } from "@/lib/swr";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { cn } from "@/lib/cn";

const inputClass = cn(
  "mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900",
  "outline-none ring-brand-green/20 focus:border-brand-green focus:ring-2",
);

type GroupMemberRow = {
  userId: string;
  turnOrder: number;
  status: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
};

type GroupDetail = {
  id: string;
  name: string;
  description: string | null;
  inviteCode: string;
  status: string;
  contributionAmount: string;
  daysPerCycle: number;
  payoutMode: PayoutMode;
  memberSlots: number;
  groupStartDate: string | null;
  members: GroupMemberRow[];
};

export default function AdminGroupDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data: group, error } = useSWR<GroupDetail>(id ? `/groups/${id}` : null, {
    refreshInterval: LIVE_POLL_MS,
  });

  const [editOpen, setEditOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [actPending, setActPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copyDone, setCopyDone] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [contributionAmount, setContributionAmount] = useState("");
  const [payoutMode, setPayoutMode] = useState<PayoutMode>(PayoutMode.CYCLE);
  const [daysPerCycle, setDaysPerCycle] = useState("");
  const [groupSize, setGroupSize] = useState("");
  const [startDate, setStartDate] = useState("");

  const activeMembers = useMemo(
    () => group?.members.filter((m) => m.status === "ACTIVE") ?? [],
    [group],
  );

  function openEdit() {
    if (!group) return;
    setName(group.name);
    setDescription(group.description ?? "");
    setContributionAmount(group.contributionAmount);
    setPayoutMode(group.payoutMode);
    setDaysPerCycle(String(group.daysPerCycle));
    setGroupSize(String(group.memberSlots));
    const gd = group.groupStartDate
      ? new Date(group.groupStartDate).toISOString().slice(0, 10)
      : "";
    setStartDate(gd);
    setEditOpen(true);
    setErr(null);
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!group) return;
    setErr(null);
    setPending(true);
    try {
      await apiFetch(`/groups/${group.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          description: description || undefined,
          contributionAmount: Number(contributionAmount),
          payoutMode,
          daysPerCycle:
            payoutMode === PayoutMode.CYCLE
              ? Number(daysPerCycle)
              : undefined,
          groupSize: Number(groupSize),
          startDate,
        }),
      });
      setEditOpen(false);
      await mutate(`/groups/${id}`);
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Update failed");
    } finally {
      setPending(false);
    }
  }

  async function onActivate() {
    if (!group) return;
    setErr(null);
    setActPending(true);
    try {
      await apiFetch(`/groups/${group.id}/activate`, { method: "POST" });
      await mutate(`/groups/${id}`);
      router.refresh();
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Activation failed");
    } finally {
      setActPending(false);
    }
  }

  async function copyCode() {
    if (!group?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(group.inviteCode);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    } catch {
      setErr("Could not copy to clipboard");
    }
  }

  const previewResult = useMemo(() => {
    if (!editOpen) {
      return { ok: true as const, reason: undefined as string | undefined };
    }
    const c = Number(contributionAmount);
    const g = Number(groupSize);
    const dpc = Number(daysPerCycle);
    if (!Number.isFinite(c) || !Number.isFinite(g)) {
      return {
        ok: false as const,
        reason: "Enter valid contribution and group size",
      };
    }
    if (payoutMode === PayoutMode.CYCLE) {
      if (!Number.isFinite(dpc) || !Number.isInteger(dpc)) {
        return {
          ok: false as const,
          reason: "Enter a valid whole number of days per cycle",
        };
      }
    }
    return computeGroupFinancePreview({
      contributionAmount: c,
      groupSize: g,
      payoutMode,
      daysPerCycle: payoutMode === PayoutMode.CYCLE ? dpc : undefined,
      startDate,
    });
  }, [
    editOpen,
    contributionAmount,
    daysPerCycle,
    groupSize,
    payoutMode,
    startDate,
  ]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error instanceof Error ? error.message : "Failed to load group"}
        </p>
        <Link
          href="/admin/groups"
          className="mt-4 inline-block text-sm font-medium text-brand-green"
        >
          Back to groups
        </Link>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-xl bg-gray-200/80"
          />
        ))}
      </div>
    );
  }

  const isDraft = group.status === "DRAFT";
  const canActivate =
    isDraft && activeMembers.length === group.memberSlots && group.memberSlots > 0;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/groups"
            className="text-sm font-medium text-brand-green hover:underline"
          >
            ← Groups
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">{group.name}</h1>
          <div className="mt-2">
            <StatusBadge status={group.status} />
          </div>
        </div>
      </div>

      {err && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {err}
        </p>
      )}

      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-card sm:p-6">
        <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">
          Invite code
        </h2>
        {isDraft ? (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <code className="rounded-lg bg-gray-100 px-3 py-2 text-lg font-semibold tracking-wider text-gray-900">
                {group.inviteCode}
              </code>
              <button
                type="button"
                onClick={copyCode}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                <Copy className="h-4 w-4" />
                {copyDone ? "Copied" : "Copy code"}
              </button>
            </div>
            <p className="mt-3 text-sm text-gray-600">
              Share this code with members to join the group.
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm text-gray-600">
            Invite codes are only active while the group is in draft. This group
            is <span className="font-medium">{group.status}</span>
            {group.status === "ACTIVE"
              ? " — new members cannot join by code."
              : "."}
          </p>
        )}
        <p className="mt-4 text-sm text-gray-700">
          <span className="font-semibold">Payout model:</span>{" "}
          {group.payoutMode === PayoutMode.DAILY
            ? "Daily (one payment per member per cycle)"
            : `Cycle (${group.daysPerCycle} day(s) per cycle)`}
        </p>
        <p className="mt-4 text-sm text-gray-700">
          <span className="font-semibold">Members:</span>{" "}
          {activeMembers.length} / {group.memberSlots}
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {isDraft && (
          <button
            type="button"
            onClick={openEdit}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50"
          >
            <Pencil className="h-4 w-4" />
            Edit Group
          </button>
        )}
        {isDraft && (
          <button
            type="button"
            disabled={!canActivate || actPending}
            title={
              canActivate
                ? undefined
                : "Fill all member slots before activating"
            }
            onClick={onActivate}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-brand-green px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-brand-green-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {actPending ? "Activating…" : "Activate Group"}
          </button>
        )}
      </div>

      <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-card">
        <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">
          Roster
        </h2>
        {activeMembers.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No members yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100 text-sm">
            {activeMembers
              .slice()
              .sort((a, b) => a.turnOrder - b.turnOrder)
              .map((m) => (
                <li
                  key={m.userId}
                  className="flex justify-between gap-2 py-2 text-gray-800"
                >
                  <span>
                    {[m.user.firstName, m.user.lastName]
                      .filter(Boolean)
                      .join(" ") || m.user.email}
                  </span>
                  <span className="text-gray-500">Turn {m.turnOrder}</span>
                </li>
              ))}
          </ul>
        )}
      </div>

      {editOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">Edit draft group</h3>
            <form onSubmit={onSaveEdit} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500">
                  Name
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">
                  Description
                </label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">
                  Payout model
                </label>
                <select
                  value={payoutMode}
                  onChange={(e) =>
                    setPayoutMode(e.target.value as PayoutMode)
                  }
                  className={inputClass}
                >
                  <option value={PayoutMode.DAILY}>
                    Daily (one payment per member per cycle)
                  </option>
                  <option value={PayoutMode.CYCLE}>
                    Cycle (members pay every day for N days)
                  </option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500">
                    {payoutMode === PayoutMode.DAILY
                      ? "Contribution / member / cycle (GHS)"
                      : "Contribution / day (GHS)"}
                  </label>
                  <input
                    type="number"
                    min={0.01}
                    step="0.01"
                    required
                    value={contributionAmount}
                    onChange={(e) => setContributionAmount(e.target.value)}
                    className={inputClass}
                  />
                </div>
                {payoutMode === PayoutMode.CYCLE ? (
                  <div>
                    <label className="text-xs font-semibold text-gray-500">
                      Days per cycle
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={366}
                      step={1}
                      required
                      value={daysPerCycle}
                      onChange={(e) => setDaysPerCycle(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                ) : (
                  <div aria-hidden className="hidden sm:block" />
                )}
              </div>
              {payoutMode === PayoutMode.CYCLE && (
                <p className="text-xs text-gray-500">
                  Members contribute daily for this number of days before each
                  payout.
                </p>
              )}
              <div>
                <label className="text-xs font-semibold text-gray-500">
                  Group size
                </label>
                <input
                  type="number"
                  min={Math.max(5, activeMembers.length)}
                  max={250}
                  required
                  value={groupSize}
                  onChange={(e) => setGroupSize(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">
                  Start date
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              {!previewResult.ok && (
                <p className="text-sm text-amber-800">{previewResult.reason}</p>
              )}
              {err && <p className="text-sm text-red-600">{err}</p>}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-semibold text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending || !previewResult.ok}
                  className="flex-1 rounded-xl bg-brand-green py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
