"use client";

import { useEffect, useState } from "react";
import { getApiBase } from "@/lib/api";

type Tier = "local" | "staging" | "production" | "unknown";

function resolveTier(): Tier {
  const explicit = process.env.NEXT_PUBLIC_DEPLOYMENT_TIER?.trim().toLowerCase();
  if (explicit === "local" || explicit === "staging" || explicit === "production") {
    return explicit;
  }
  if (process.env.NODE_ENV === "production") return "production";
  return "local";
}

const STYLES: Record<Tier, { bg: string; label: string }> = {
  local: { bg: "bg-amber-600", label: "LOCAL" },
  staging: { bg: "bg-violet-700", label: "STAGING" },
  production: { bg: "bg-emerald-800", label: "PRODUCTION" },
  unknown: { bg: "bg-gray-600", label: "UNKNOWN" },
};

export function EnvironmentBanner() {
  const tier = resolveTier();
  const style = STYLES[tier];
  const [apiOk, setApiOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (tier === "production") return;
    const base = getApiBase();
    if (!base) {
      setApiOk(false);
      return;
    }
    fetch(`${base}/health`)
      .then((r) => r.json())
      .then((h) => setApiOk(h?.status === "ok" || h?.status === "degraded"))
      .catch(() => setApiOk(false));
  }, [tier]);

  if (tier === "production") return null;

  return (
    <div
      className={`${style.bg} flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-3 py-1.5 text-center text-xs font-semibold tracking-wide text-white`}
      role="status"
    >
      <span>{style.label}</span>
      <span className="font-normal opacity-90">
        MoMo simulated · financial authority = API
      </span>
      {apiOk === false && (
        <span className="rounded bg-black/25 px-2 py-0.5 font-normal">
          API offline — check NEXT_PUBLIC_API_URL
        </span>
      )}
      {apiOk === true && (
        <span className="font-normal opacity-75">API connected</span>
      )}
    </div>
  );
}
