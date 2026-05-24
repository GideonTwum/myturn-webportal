#!/usr/bin/env node
/**
 * Post-deploy acceptance checks for Railway staging API.
 *
 * Usage:
 *   STAGING_API_URL=https://your-app.up.railway.app/api node scripts/verify-railway-health.mjs
 */
const BASE = (
  process.env.STAGING_API_URL ??
  process.env.API_URL ??
  ""
).replace(/\/+$/, "");

if (!BASE) {
  console.error("Set STAGING_API_URL (e.g. https://xxx.up.railway.app/api)");
  process.exit(1);
}

const checks = [];

function ok(name) {
  checks.push({ name, pass: true });
  console.log(`  ✓ ${name}`);
}

function fail(name, detail) {
  checks.push({ name, pass: false, detail });
  console.error(`  ✗ ${name}: ${detail}`);
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

async function main() {
  console.log(`\nRailway staging verification @ ${BASE}\n`);

  let health;
  try {
    health = await fetchJson("/health");
    ok("GET /api/health");
  } catch (e) {
    fail("GET /api/health", e instanceof Error ? e.message : String(e));
    console.error("\nFix networking/PORT/deploy first.\n");
    process.exit(1);
  }

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

  const otpStore = health.infrastructure?.otpStore ?? "?";
  const redisCheck = health.checks?.redis;
  if (redisCheck === "ok" && otpStore === "redis") {
    ok("Redis connected (OTP store: redis)");
  } else if (redisCheck === "skipped" || otpStore === "memory") {
    ok("Redis skipped — memory OTP fallback (attach Redis for testers)");
  } else if (redisCheck === "error") {
    fail("Redis", "configured but ping failed");
  }

  const sms = health.infrastructure?.sms?.provider ?? health.infrastructure?.smsProvider ?? "?";
  if (sms === "console") ok("SMS_PROVIDER=console");
  else fail("SMS provider", `expected console for default staging, got ${sms}`);

  const pay = health.infrastructure?.payment?.provider ?? health.infrastructure?.paymentProvider ?? "?";
  if (pay === "mock" || pay === "mock-momo") ok("PAYMENT_PROVIDER=mock or mock-momo");
  else fail("payment provider", `expected mock or mock-momo, got ${pay}`);

  if (health.featureFlags?.mockPayments === true) ok("MOCK_PAYMENTS enabled");
  else fail("MOCK_PAYMENTS", "expected true in staging");

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

  const demo = await fetchInvitePreview("STAGING-DEMO");
  if (demo.ok && demo.body?.inviteCode) {
    ok("GET /groups/invite/STAGING-DEMO (joinable)");
  } else {
    fail(
      "STAGING-DEMO invite",
      demo.ok ? "missing inviteCode" : `${demo.status}: ${demo.message.slice(0, 120)}`,
    );
  }

  const payInvite = await fetchInvitePreview("STAGING-PAY");
  if (payInvite.ok && payInvite.body?.inviteCode) {
    ok("GET /groups/invite/STAGING-PAY");
  } else if (
    payInvite.status === 400 &&
    payInvite.message.includes("This group is no longer accepting members")
  ) {
    ok("GET /groups/invite/STAGING-PAY (active payment lab — closed to new joins)");
  } else {
    fail(
      "STAGING-PAY invite",
      payInvite.ok
        ? "missing inviteCode"
        : `${payInvite.status}: ${payInvite.message.slice(0, 120)}`,
    );
  }

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n--- ${checks.length - failed.length}/${checks.length} passed ---\n`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
