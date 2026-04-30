"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  ADMIN_SHARE_PERCENTAGE,
  MYTURN_SHARE_PERCENTAGE,
  SERVICE_MARGIN_PERCENTAGE,
} from "@myturn/shared";
import { Shield } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/cn";

type SettingRow = { key: string; value: unknown };

const inputClass = cn(
  "mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900",
  "outline-none ring-brand-green/15 focus:border-brand-green focus:ring-2",
);

export default function HqSettingsPage() {
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [key, setKey] = useState("platform.displayName");
  const [value, setValue] = useState("MyTurn");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function reload() {
    apiFetch<SettingRow[]>("/settings")
      .then(setRows)
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed"));
  }

  useEffect(() => {
    reload();
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      await apiFetch("/settings", {
        method: "PUT",
        body: JSON.stringify({ key, value }),
      });
      setMsg("Saved");
      reload();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Failed");
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm text-gray-600">
        Platform configuration for MVP. Revenue percentages are fixed in code —
        MyTurn HQ cannot change the settlement formula from this portal.
      </p>

      <section className="mt-8 overflow-hidden rounded-2xl border-2 border-brand-gold/35 bg-gradient-to-br from-brand-gold-soft/90 to-white shadow-card-md">
        <div className="flex items-start gap-3 border-b border-brand-gold/25 bg-white/60 px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gold/20 text-brand-gold-dark">
            <Shield className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Revenue rules (read-only)
            </h2>
            <p className="mt-0.5 text-xs text-amber-900/80">
              Service margin {SERVICE_MARGIN_PERCENTAGE}% of gross collected per
              cycle. Margin split: {ADMIN_SHARE_PERCENTAGE}% admin /{" "}
              {MYTURN_SHARE_PERCENTAGE}% MyTurn. Same values power group
              preview, payouts, ledger, and HQ reporting. To change a release,
              update <code className="rounded bg-white/80 px-1">packages/shared</code>{" "}
              and redeploy.
            </p>
          </div>
        </div>
        <div className="p-5 sm:p-6">
          <ul className="grid gap-3 text-sm text-gray-800 sm:grid-cols-3">
            <li className="rounded-xl border border-gray-200 bg-white px-3 py-2">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Service margin
              </span>
              <p className="mt-1 text-lg font-bold text-gray-900">
                {SERVICE_MARGIN_PERCENTAGE}%
              </p>
            </li>
            <li className="rounded-xl border border-gray-200 bg-white px-3 py-2">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Admin (of margin)
              </span>
              <p className="mt-1 text-lg font-bold text-brand-gold-dark">
                {ADMIN_SHARE_PERCENTAGE}%
              </p>
            </li>
            <li className="rounded-xl border border-gray-200 bg-white px-3 py-2">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                MyTurn (of margin)
              </span>
              <p className="mt-1 text-lg font-bold text-blue-800">
                {MYTURN_SHARE_PERCENTAGE}%
              </p>
            </li>
          </ul>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-bold text-gray-900">
          Other settings (key–value)
        </h2>
        <form
          onSubmit={save}
          className="mt-3 max-w-xl space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-card sm:p-6"
        >
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Key
            </label>
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Value (JSON or string)
            </label>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50"
          >
            Save
          </button>
          {msg && (
            <p className="text-sm font-medium text-green-700">{msg}</p>
          )}
          {err && <p className="text-sm text-red-600">{err}</p>}
        </form>
      </section>

      <ul className="mt-8 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white text-sm shadow-card">
        {rows.map((r) => (
          <li
            key={r.key}
            className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:justify-between"
          >
            <span className="font-mono text-xs font-medium text-gray-800">
              {r.key}
            </span>
            <span className="text-gray-600">{JSON.stringify(r.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
