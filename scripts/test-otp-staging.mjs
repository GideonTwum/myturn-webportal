#!/usr/bin/env node
/**
 * Staging OTP smoke — request, cooldown hint, verify flow.
 *
 * Usage:
 *   STAGING_API_URL=https://myturn-webportal-production.up.railway.app/api node scripts/test-otp-staging.mjs
 */
const BASE = (
  process.env.STAGING_API_URL ??
  process.env.API_URL ??
  "http://localhost:3001/api"
).replace(/\/+$/, "");

const PHONE = process.env.E2E_MEMBER_PHONE ?? "0240000001";

let passed = 0;
let failed = 0;

function ok(name) {
  passed++;
  console.log(`  ✓ ${name}`);
}

function fail(name, err) {
  failed++;
  console.error(`  ✗ ${name}`);
  console.error(`    ${err instanceof Error ? err.message : String(err)}`);
}

async function fetchJson(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const msg =
      typeof body === "object" && body?.message
        ? JSON.stringify(body.message)
        : text.slice(0, 200);
    const err = new Error(`${res.status}: ${msg}`);
    err.status = res.status;
    throw err;
  }
  if (body && typeof body === "object" && "success" in body && "data" in body) {
    return body.data;
  }
  return body;
}

async function testHealthOtpStore() {
  const h = await fetchJson("/health");
  const store = h.infrastructure?.otpStore ?? "?";
  if (store === "redis" || store === "memory") {
    ok(`OTP store mode: ${store}`);
  } else {
    fail("OTP store", `unexpected: ${store}`);
  }
  if (h.checks?.redis === "ok") ok("Redis connected");
  else if (h.checks?.redis === "skipped") {
    ok("Redis skipped (memory fallback — attach Redis for staging)");
  } else {
    fail("Redis", String(h.checks?.redis));
  }
}

async function testOtpRequestVerify() {
  const req = await fetchJson("/auth/otp/request", {
    method: "POST",
    body: JSON.stringify({ phone: PHONE }),
  });
  const code = req.debugCode;
  if (!code) {
    fail("OTP debugCode", "missing — set DEPLOYMENT_TIER=staging, SMS_PROVIDER=console");
    return;
  }
  ok("OTP request returned debugCode (staging)");

  const session = await fetchJson("/auth/otp/verify", {
    method: "POST",
    body: JSON.stringify({ phone: PHONE, code }),
  });
  const token = session.access_token ?? session.accessToken;
  if (!token) fail("OTP verify", "missing access token");
  else ok("OTP verify issued token");
}

async function testResendCooldown() {
  await fetchJson("/auth/otp/request", {
    method: "POST",
    body: JSON.stringify({ phone: PHONE }),
  });
  try {
    await fetchJson("/auth/otp/request", {
      method: "POST",
      body: JSON.stringify({ phone: PHONE }),
    });
    fail("resend cooldown", "expected 429 on immediate resend");
  } catch (e) {
    if (e.status === 429) ok("resend cooldown returns 429");
    else fail("resend cooldown", e);
  }
}

async function main() {
  console.log(`\nOTP staging tests @ ${BASE}\n`);
  try {
    await testHealthOtpStore();
  } catch (e) {
    fail("health", e);
  }
  try {
    await testOtpRequestVerify();
  } catch (e) {
    fail("OTP request/verify", e);
  }
  try {
    await testResendCooldown();
  } catch (e) {
    fail("cooldown", e);
  }
  console.log(`\n--- ${passed} passed, ${failed} failed ---\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
