#!/usr/bin/env node
/**
 * Post-deploy acceptance checks for Railway staging API.
 *
 * Usage:
 *   STAGING_API_URL=https://your-app.up.railway.app/api node scripts/verify-railway-health.mjs
 *
 * Rollout gate (fail if Redis not ready for 5-tester rollout):
 *   STRICT_ROLLOUT=1 STAGING_API_URL=... node scripts/verify-railway-health.mjs
 */
const BASE = (
  process.env.STAGING_API_URL ??
  process.env.API_URL ??
  ""
).replace(/\/+$/, "");

const STRICT_ROLLOUT = process.env.STRICT_ROLLOUT === "1" || process.env.STRICT_ROLLOUT === "true";

if (!BASE) {
  console.error("Set STAGING_API_URL (e.g. https://xxx.up.railway.app/api)");
  process.exit(1);
}

const checks = [];
const warnings = [];

function ok(name) {
  checks.push({ name, pass: true });
  console.log(`  ✓ ${name}`);
}

function fail(name, detail) {
  checks.push({ name, pass: false, detail });
  console.error(`  ✗ ${name}: ${detail}`);
}

function warn(name, detail) {
  warnings.push({ name, detail });
  console.log(`  ⚠ ${name}: ${detail}`);
}

async function fetchJson(path) {
  const res = await fetch(`${BASE}${path}`);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`${res.status} ${path}: ${text.slice(0, 200)}`);
  }
  return body;
}

async function fetchInvitePreview(code) {
  const res = await fetch(`${BASE}/groups/invite/${code}`);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  const rawMessage =
    typeof body === "object" && body !== null && "message" in body ? body.message : text;
  const message = Array.isArray(rawMessage) ? rawMessage.join(", ") : String(rawMessage);
  return { ok: res.ok, status: res.status, body, message };
}

function checkRedis(health) {
  console.log("\n  — Redis & OTP —");
  const infra = health.infrastructure ?? {};
  const redisBlock = infra.redis && typeof infra.redis === "object" ? infra.redis : null;
  const otpStore = redisBlock?.otpStore ?? infra.otpStore ?? "?";
  const idempotency = redisBlock?.idempotency ?? infra.idempotency ?? "?";
  const redisCheck = redisBlock?.check ?? health.checks?.redis ?? "?";
  const configured = redisBlock?.configured ?? Boolean(process.env.REDIS_URL);
  const rolloutReady = redisBlock?.rolloutReady ?? (redisCheck === "ok" && otpStore === "redis");

  console.log(`    OTP store: ${otpStore}`);
  console.log(`    Idempotency: ${idempotency}`);
  console.log(`    Redis check: ${redisCheck}`);

  if (redisCheck === "ok" && otpStore === "redis") {
    ok("Redis connected — OTP + idempotency on Redis");
  } else   if (redisCheck === "error") {
    fail("Redis", "REDIS_URL set but ping failed");
    const pingErr = health.infrastructure?.redis?.lastPingError;
    if (pingErr) warn("Redis ping detail", pingErr);
  } else if (redisCheck === "skipped" || otpStore === "memory") {
    ok("Redis not attached — memory OTP fallback (OK for dev, not for tester rollout)");
    warn(
      "Redis rollout",
      "Attach Railway Redis + REDIS_URL before 5-tester rollout (docs/RAILWAY_REDIS.md)",
    );
    if (STRICT_ROLLOUT) {
      fail("STRICT_ROLLOUT", "Redis required for controlled tester rollout");
    }
  } else {
    fail("Redis", `unexpected state: check=${redisCheck}, otpStore=${otpStore}`);
  }

  if (configured && redisCheck !== "ok") {
    warn("Redis config", "REDIS_URL appears configured but health check did not pass");
  }

  return { otpStore, rolloutReady };
}

function checkOtpMode(health) {
  console.log("\n  — OTP mode —");
  const flags = health.featureFlags ?? {};
  const sms = health.infrastructure?.sms?.provider ?? health.infrastructure?.smsProvider ?? "?";
  const debugOtp = flags.debugOtpInResponses === true;

  if (debugOtp) ok("Debug OTP in API responses (staging console SMS)");
  else warn("OTP debug", "debugOtpInResponses=false — testers may not see on-screen codes");

  if (sms === "console") ok(`SMS provider: ${sms} (codes logged, not sent via SMS)`);
  else fail("SMS provider", `expected console for staging, got ${sms}`);

  const metrics = health.infrastructure?.otpMetrics;
  if (metrics && typeof metrics === "object") {
    console.log(
      `    OTP telemetry: requests=${metrics.requests ?? 0}, verifies=${metrics.verifies ?? 0}`,
    );
  }
}

function checkPayments(health) {
  console.log("\n  — Payments —");
  const pay =
    health.infrastructure?.payment?.provider ??
    health.infrastructure?.paymentProvider ??
    "?";
  const payHealth = health.infrastructure?.payment?.health ?? "?";

  if (pay === "mock" || pay === "mock-momo") {
    ok(`Payment provider: ${pay} (simulated MoMo — no real money)`);
  } else {
    fail("payment provider", `expected mock or mock-momo, got ${pay}`);
  }

  console.log(`    Payment health: ${payHealth}`);

  if (health.featureFlags?.mockPayments === true) ok("MOCK_PAYMENTS enabled");
  else fail("MOCK_PAYMENTS", "expected true in staging");
}

function checkInviteGroups() {
  console.log("\n  — Staging invite groups —");
  console.log("    STAGING-DEMO = joinable onboarding test");
  console.log("    STAGING-PAY  = active/full payment lab (seeded accounts only)");
}

async function main() {
  console.log(`\nRailway staging verification @ ${BASE}`);
  if (STRICT_ROLLOUT) console.log("STRICT_ROLLOUT=1 — Redis required for pass\n");
  else console.log("");

  let health;
  try {
    health = await fetchJson("/health");
    ok("GET /api/health");
  } catch (e) {
    fail("GET /api/health", e instanceof Error ? e.message : String(e));
    console.error("\nFix networking/PORT/deploy first.\n");
    process.exit(1);
  }

  console.log("\n  — Core —");

  if (health.status === "ok" || health.status === "degraded") {
    ok(`health status=${health.status}`);
  } else {
    fail("health status", String(health.status));
  }

  if (health.deploymentTier === "staging" || health.environment === "staging") {
    ok("DEPLOYMENT_TIER=staging");
  } else {
    fail("deployment tier", `expected staging, got ${health.deploymentTier ?? health.environment}`);
  }

  if (health.checks?.database === "ok") ok("database connected");
  else fail("database", String(health.checks?.database));

  const apiBase = health.apiBaseUrl ?? "";
  if (apiBase.includes("localhost")) {
    fail("PUBLIC_API_URL", `apiBaseUrl still localhost: ${apiBase}`);
  } else if (apiBase) {
    ok(`apiBaseUrl=${apiBase}`);
  } else {
    warn("PUBLIC_API_URL", "apiBaseUrl missing from health payload");
  }

  checkRedis(health);
  checkOtpMode(health);
  checkPayments(health);

  if (health.featureFlags?.stagingRelaxTrust === true) {
    ok("STAGING_RELAX_TRUST enabled");
  } else {
    fail("STAGING_RELAX_TRUST", "expected true in staging");
  }

  if (health.stagingSeed?.status === "ok") {
    ok("staging seed present (STAGING-DEMO, STAGING-PAY)");
  } else {
    fail(
      "staging seed",
      health.stagingSeed?.missing?.join(", ") ?? "missing — run seed:staging:railway",
    );
  }

  if (Array.isArray(health.warnings) && health.warnings.length > 0) {
    console.log("\n  — Health warnings —");
    for (const w of health.warnings) console.log(`    • ${w}`);
  }

  checkInviteGroups();

  const demo = await fetchInvitePreview("STAGING-DEMO");
  if (demo.ok && demo.body?.inviteCode) {
    ok("STAGING-DEMO: joinable (200 + inviteCode)");
  } else {
    fail(
      "STAGING-DEMO invite",
      demo.ok ? "missing inviteCode" : `${demo.status}: ${demo.message.slice(0, 120)}`,
    );
  }

  const payInvite = await fetchInvitePreview("STAGING-PAY");
  if (payInvite.ok && payInvite.body?.inviteCode) {
    ok("STAGING-PAY: invite preview OK (group may still accept joins)");
  } else if (
    payInvite.status === 400 &&
    payInvite.message.includes("This group is no longer accepting members")
  ) {
    ok("STAGING-PAY: active payment lab — closed to new joins (expected 400)");
  } else if (payInvite.status === 400 && payInvite.message.includes("This group is full")) {
    ok("STAGING-PAY: group full — use seeded test account for payments");
  } else {
    fail(
      "STAGING-PAY invite",
      payInvite.ok
        ? "missing inviteCode"
        : `${payInvite.status}: ${payInvite.message.slice(0, 120)}`,
    );
  }

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n--- ${checks.length - failed.length}/${checks.length} checks passed ---`);
  if (warnings.length > 0) {
    console.log(`--- ${warnings.length} warning(s) — review before tester rollout ---`);
  }
  console.log("\nNext: docs/TESTER_ROLLOUT_CHECKLIST.md · docs/REAL_DEVICE_SMOKE_TEST.md\n");
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
