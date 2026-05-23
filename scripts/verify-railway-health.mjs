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

  const sms = health.infrastructure?.sms?.provider ?? "?";
  if (sms === "console") ok("SMS_PROVIDER=console");
  else fail("SMS provider", `expected console for default staging, got ${sms}`);

  const pay = health.infrastructure?.payment?.provider ?? "?";
  if (pay === "mock") ok("PAYMENT_PROVIDER=mock");
  else fail("payment provider", `expected mock, got ${pay}`);

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

  try {
    const demo = await fetchJson("/groups/invite/STAGING-DEMO");
    if (demo.inviteCode) ok("GET /groups/invite/STAGING-DEMO");
    else fail("STAGING-DEMO", "missing inviteCode");
  } catch (e) {
    fail("STAGING-DEMO invite", e instanceof Error ? e.message : String(e));
  }

  try {
    const payGroup = await fetchJson("/groups/invite/STAGING-PAY");
    if (payGroup.inviteCode) ok("GET /groups/invite/STAGING-PAY");
    else fail("STAGING-PAY", "missing inviteCode");
  } catch (e) {
    fail("STAGING-PAY invite", e instanceof Error ? e.message : String(e));
  }

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n--- ${checks.length - failed.length}/${checks.length} passed ---\n`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
