#!/usr/bin/env node
const BASE = (
  process.env.STAGING_API_URL ??
  process.env.API_URL ??
  "http://localhost:3001/api"
).replace(/\/+$/, "");

const MAX_MS = Number(process.env.WAIT_FOR_API_MS ?? 90_000);
const INTERVAL_MS = 1500;

async function ping() {
  const res = await fetch(`${BASE}/health`);
  if (!res.ok) return null;
  return res.json();
}

async function main() {
  const started = Date.now();
  console.log(`[wait-for-api] Waiting for ${BASE}/health (max ${MAX_MS}ms)`);
  while (Date.now() - started < MAX_MS) {
    try {
      const h = await ping();
      if (h?.status === "ok" || h?.status === "degraded") {
        console.log(`[wait-for-api] Ready (${h.environment}) in ${Date.now() - started}ms`);
        return;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
  console.error("[wait-for-api] API did not become healthy in time");
  process.exit(1);
}

main();
