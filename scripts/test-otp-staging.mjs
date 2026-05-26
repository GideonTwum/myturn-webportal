#!/usr/bin/env node
/**
 * Staging OTP smoke — request, verify, cooldown, invalid code.
 *
 * Usage:
 *   STAGING_API_URL=https://myturn-webportal-production.up.railway.app/api node scripts/test-otp-staging.mjs
 */
const BASE = (
  process.env.STAGING_API_URL ??
  process.env.API_URL ??
  "http://localhost:3001/api"
).replace(/\/+$/, "");

const PHONE_PRIMARY = process.env.E2E_MEMBER_PHONE ?? "0240000001";

/** Unique phone per run avoids 429 collisions from repeated CI/manual runs. */
function ephemeralPhone(offset = 0) {
  const tail = String((Date.now() + offset) % 10_000_000).padStart(7, "0");
  return `024${tail}`;
}

let passed = 0;
let failed = 0;

function section(title) {
  console.log(`\n  — ${title} —`);
}

function ok(name) {
  passed++;
  console.log(`  ✓ ${name}`);
}

function fail(name, err) {
  failed++;
  console.error(`  ✗ ${name}`);
  console.error(`    ${err instanceof Error ? err.message : String(err)}`);
}

function info(line) {
  console.log(`    ${line}`);
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
    const raw = typeof body === "object" && body?.message ? body.message : text.slice(0, 200);
    const msg = Array.isArray(raw) ? raw.join(", ") : String(raw);
    const err = new Error(`${res.status}: ${msg}`);
    err.status = res.status;
    throw err;
  }
  if (body && typeof body === "object" && "success" in body && "data" in body) {
    return body.data;
  }
  return body;
}

async function fetchRaw(path, init = {}) {
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
  return { status: res.status, body, text };
}

async function testHealthOtpStore() {
  section("Health & OTP store");
  const h = await fetchJson("/health");
  const infra = h.infrastructure ?? {};
  const redisBlock = infra.redis && typeof infra.redis === "object" ? infra.redis : null;
  const store = redisBlock?.otpStore ?? infra.otpStore ?? "?";
  const redisCheck = redisBlock?.check ?? h.checks?.redis ?? "?";
  const rolloutReady = redisBlock?.rolloutReady ?? false;

  info(`OTP store: ${store}`);
  info(`Redis check: ${redisCheck}`);
  info(`Rollout ready: ${rolloutReady ? "yes" : "no (attach Redis for testers)"}`);

  if (store === "redis" || store === "memory") {
    ok(`OTP store mode: ${store}`);
  } else {
    fail("OTP store", `unexpected: ${store}`);
  }

  if (redisCheck === "ok" && store === "redis") {
    ok("Redis connected — OTP persists across redeploys");
  } else if (redisCheck === "skipped" || store === "memory") {
    ok("Memory OTP fallback (local OK — attach Redis before tester rollout)");
    info("OTP codes are lost when Railway redeploys without Redis");
  } else if (redisCheck === "error") {
    fail("Redis", "configured but ping failed");
  }

  if (h.featureFlags?.debugOtpInResponses) {
    ok("debugOtpInResponses enabled (staging codes in API)");
  } else {
    info("debugOtpInResponses=false — mobile may not show on-screen OTP");
  }
}

async function testOtpRequestVerifyAndInvalid() {
  section("Request, invalid code, verify");
  const phone = process.env.E2E_MEMBER_PHONE_FLOW ?? ephemeralPhone(1);
  info(`Flow phone: ${phone}`);
  const req = await fetchJson("/auth/otp/request", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
  const code = req.debugCode;
  if (!code) {
    fail("OTP debugCode", "missing — set DEPLOYMENT_TIER=staging, SMS_PROVIDER=console");
    return;
  }
  ok("OTP request returned debugCode (staging)");
  info(`Code length: ${String(code).length} digits`);

  const bad = await fetchRaw("/auth/otp/verify", {
    method: "POST",
    body: JSON.stringify({ phone, code: "000000" }),
  });
  if (bad.status === 401) {
    ok("invalid OTP returns 401 Unauthorized");
  } else {
    fail("invalid OTP", `expected 401, got ${bad.status}`);
  }
  info("Expired codes use the same response (TTL ~10 min — not tested automatically)");

  const session = await fetchJson("/auth/otp/verify", {
    method: "POST",
    body: JSON.stringify({ phone, code }),
  });
  const token = session.access_token ?? session.accessToken;
  if (!token) fail("OTP verify", "missing access token");
  else ok("OTP verify issued access token");
}

async function testResendCooldown() {
  section("Resend cooldown");
  const phone = process.env.E2E_MEMBER_PHONE_COOLDOWN ?? ephemeralPhone(99_999);
  info(`Cooldown phone: ${phone}`);
  await fetchJson("/auth/otp/request", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
  try {
    await fetchJson("/auth/otp/request", {
      method: "POST",
      body: JSON.stringify({ phone }),
    });
    fail("resend cooldown", "expected 429 on immediate resend");
  } catch (e) {
    if (e.status === 429) {
      ok("immediate resend returns 429 Too Many Requests");
      info("Wait for cooldown before requesting again on device");
    } else {
      fail("resend cooldown", e);
    }
  }
}

async function main() {
  console.log(`\nOTP staging tests @ ${BASE}`);
  console.log(`Seeded payment member (manual/device): ${PHONE_PRIMARY}\n`);

  try {
    await testHealthOtpStore();
  } catch (e) {
    fail("health", e);
  }
  try {
    await testOtpRequestVerifyAndInvalid();
  } catch (e) {
    fail("OTP request/verify/invalid", e);
  }
  try {
    await testResendCooldown();
  } catch (e) {
    fail("cooldown", e);
  }

  console.log(`\n--- ${passed} passed, ${failed} failed ---`);
  if (failed === 0) console.log("OTP staging validation OK\n");
  else console.log("Fix OTP issues before tester rollout\n");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
