#!/usr/bin/env node
/**
 * Post-deploy acceptance checks for Railway staging API (mock UAT mode).
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
const EXPECTED_WEB_ORIGIN =
  process.env.STAGING_WEB_ORIGIN?.replace(/\/+$/, "") ??
  "https://myturn-webportal-web-portal.vercel.app";

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

async function fetchJson(path, opts) {
  const res = await fetch(`${BASE}${path}`, opts);
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

  console.log(`    OTP store: ${otpStore}`);
  console.log(`    Idempotency: ${idempotency}`);
  console.log(`    Redis check: ${redisCheck}`);

  if (redisCheck === "ok" && otpStore === "redis") {
    ok("Redis connected — OTP + idempotency on Redis");
  } else if (redisCheck === "error") {
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
}

function checkOtpMode(health) {
  console.log("\n  — OTP / SMS —");
  const flags = health.featureFlags ?? {};
  const sms = health.infrastructure?.sms ?? {};
  const smsProvider = sms.provider ?? "?";
  const smsHealth = sms.health ?? "?";

  if (flags.debugOtpInResponses === true) {
    ok("Debug OTP in API responses (optional staging aid)");
  } else {
    ok("OTP via real SMS (debugOtpInResponses=false — Arkesel expected)");
  }

  if (smsProvider === "arkesel" && smsHealth === "ok") {
    ok(`SMS provider: arkesel (real OTP delivery)`);
  } else if (smsProvider === "console") {
    warn("SMS provider", "console — use arkesel for staging UAT with real phones");
  } else {
    fail("SMS provider", `expected arkesel ok for staging UAT, got ${smsProvider}/${smsHealth}`);
  }
}

function checkPayments(health) {
  console.log("\n  — Payments (mock UAT) —");
  const pay =
    health.infrastructure?.payment?.provider ??
    health.infrastructure?.paymentProvider ??
    "?";
  const disb =
    health.infrastructure?.disbursement?.provider ??
    health.infrastructure?.disbursementProvider ??
    "?";
  const payHealth = health.infrastructure?.payment?.health ?? "?";

  if (pay === "mock" || pay === "mock-momo") {
    ok(`Payment provider: ${pay} (simulated MoMo — no MTN yet)`);
  } else if (String(pay).includes("mtn")) {
    fail(
      "payment provider",
      `${pay} — set PAYMENT_PROVIDER=mock for mock UAT (remove MTN_* from active config)`,
    );
  } else {
    fail("payment provider", `expected mock or mock-momo, got ${pay}`);
  }

  if (disb === "mock" || disb === "mock-disbursement") {
    ok(`Disbursement provider: ${disb}`);
  } else if (String(disb).includes("mtn")) {
    fail("disbursement provider", `${disb} — set DISBURSEMENT_PROVIDER=mock for mock UAT`);
  } else {
    fail("disbursement provider", `expected mock-disbursement, got ${disb}`);
  }

  console.log(`    Payment health: ${payHealth}`);

  if (health.featureFlags?.mockPayments === true) ok("MOCK_PAYMENTS enabled");
  else fail("MOCK_PAYMENTS", "expected true in staging mock UAT");

  if (health.featureFlags?.mockPayoutFinalize === true) ok("MOCK_PAYOUTS enabled");
  else fail("MOCK_PAYOUTS", "expected true in staging mock UAT");
}

function checkFeatureFlags(health) {
  console.log("\n  — Feature flags —");
  if (health.featureFlags?.contributionReserveEnabled === true) {
    ok("CONTRIBUTION_RESERVE_ENABLED=true");
  } else {
    fail("CONTRIBUTION_RESERVE_ENABLED", "expected true on staging");
  }

  const webhooks = health.infrastructure?.webhooks ?? {};
  if (webhooks.secretConfigured === true) {
    ok("Webhook secrets configured");
  } else {
    fail("WEBHOOK_SECRET", "set WEBHOOK_SECRET (+ WEBHOOK_SECRET_MTN placeholder) on Railway");
  }
}

async function checkReconciliation(health) {
  console.log("\n  — Reconciliation —");
  const rec = health.infrastructure?.reconciliation ?? {};
  if (rec.enabled === false) {
    ok("Reconciliation job disabled (expected initially)");
  } else {
    warn("Reconciliation job", "ENABLE_RECONCILIATION_JOB=true — OK after mock UAT stabilizes");
  }

  try {
    const login = await fetchJson("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "hq@myturn.local",
        password: "ChangeMe123!",
      }),
    });
    const token = login.access_token ?? login.accessToken;
    if (!token) {
      warn("Reconciliation summary", "HQ login failed — skip legacy wallet check");
      return;
    }
    const summary = await fetchJson("/hq/reconciliation/summary", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (summary.status === "ok") {
      ok("HQ reconciliation summary: ok");
    } else if (summary.status === "discrepancies_detected") {
      const legacy = summary.legacyWalletWarnings ?? [];
      const critical = (summary.discrepancies ?? []).length;
      if (critical === 0 && legacy.length > 0) {
        warn(
          "Legacy wallet rows",
          `${legacy.length} warning(s) — run repair:legacy-wallet:staging --execute`,
        );
        ok("No critical reconciliation discrepancies");
      } else {
        fail(
          "Reconciliation",
          `${critical} critical discrepancy(ies): ${(summary.discrepancies ?? []).slice(0, 2).join("; ")}`,
        );
      }
    } else {
      warn("Reconciliation summary", `status=${summary.status}`);
    }
  } catch (e) {
    warn("Reconciliation summary", e instanceof Error ? e.message : String(e));
  }
}

async function checkCors() {
  console.log("\n  — CORS —");
  try {
    const res = await fetch(`${BASE}/health`, {
      headers: { Origin: EXPECTED_WEB_ORIGIN },
    });
    const allowOrigin = res.headers.get("access-control-allow-origin");
    if (allowOrigin && (allowOrigin === EXPECTED_WEB_ORIGIN || allowOrigin === "*")) {
      ok(`CORS allows web origin (${allowOrigin})`);
    } else {
      fail(
        "CORS",
        `Origin ${EXPECTED_WEB_ORIGIN} not reflected — set CORS_ORIGIN on Railway (got ${allowOrigin ?? "none"})`,
      );
    }
  } catch (e) {
    fail("CORS", e instanceof Error ? e.message : String(e));
  }
}

function checkInviteGroups() {
  console.log("\n  — Staging invite groups —");
  console.log("    STAGING-DEMO = joinable onboarding test");
  console.log("    STAGING-PAY  = mock payment lab (join → activate → contribute)");
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
  checkFeatureFlags(health);

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
      health.stagingSeed?.missing?.join(", ") ?? "missing — run npm run db:seed && npm run seed:staging:railway",
    );
  }

  if (Array.isArray(health.warnings) && health.warnings.length > 0) {
    console.log("\n  — Health warnings —");
    for (const w of health.warnings) console.log(`    • ${w}`);
  }

  checkInviteGroups();
  await checkCors();
  await checkReconciliation(health);

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
  console.log("\nNext: docs/STAGING_MOCK_UAT.md · docs/TESTER_ROLLOUT_CHECKLIST.md\n");
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
