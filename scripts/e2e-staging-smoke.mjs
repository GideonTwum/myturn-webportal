#!/usr/bin/env node
/**
 * Staging ecosystem smoke tests — API-level (no browser).
 * Requires: backend running, `npm run seed` + `npm run seed:staging`.
 *
 * Usage: STAGING_API_URL=http://localhost:3001/api node scripts/e2e-staging-smoke.mjs
 */
const BASE = (
  process.env.STAGING_API_URL ??
  process.env.API_URL ??
  "http://localhost:3001/api"
).replace(/\/+$/, "");

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@myturn.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "ChangeMe123!";
const MEMBER_PHONE = process.env.E2E_MEMBER_PHONE ?? "0240000001";
const PAY_TEST_PHONE = process.env.E2E_PAY_PHONE ?? "0240000001";
const DEMO_INVITE = process.env.E2E_INVITE_CODE ?? "STAGING-DEMO";

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
  const { headers: initHeaders, ...rest } = init;
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(initHeaders ?? {}),
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
        : text.slice(0, 300);
    throw new Error(`${res.status} ${path}: ${msg}`);
  }
  if (body && typeof body === "object" && "success" in body && "data" in body) {
    return body.data;
  }
  return body;
}

async function flowHealth() {
  const h = await fetchJson("/health");
  if (h.status !== "ok" && h.status !== "degraded") {
    throw new Error(`unexpected health status: ${h.status}`);
  }
  if (!h.environment) throw new Error("missing environment metadata");
  ok(`health (${h.environment}, db=${h.checks?.database})`);
  return h;
}

async function flowInvite() {
  const preview = await fetchJson(`/groups/invite/${DEMO_INVITE}`);
  if (!preview.inviteCode) throw new Error("invite preview missing inviteCode");
  ok(`invite preview ${preview.inviteCode} — ${preview.name}`);
  return preview;
}

async function flowAdminAuth() {
  const session = await fetchJson("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const token = session.access_token ?? session.accessToken;
  if (!token) throw new Error("admin login missing token");
  ok("admin login");
  const groups = await fetchJson("/groups/mine", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!Array.isArray(groups)) throw new Error("admin groups not an array");
  ok(`admin groups list (${groups.length})`);
  return token;
}

async function flowMemberJoin() {
  const otpReq = await fetchJson("/auth/otp/request", {
    method: "POST",
    body: JSON.stringify({ phone: MEMBER_PHONE }),
  });
  const code = otpReq.debugCode;
  if (!code) {
    throw new Error("OTP debugCode missing — ensure DEPLOYMENT_TIER is not production");
  }
  const verified = await fetchJson("/auth/otp/verify", {
    method: "POST",
    body: JSON.stringify({ phone: MEMBER_PHONE, code }),
  });
  const token = verified.access_token ?? verified.accessToken;
  if (!token) throw new Error("member OTP missing token");
  ok("member OTP verify");

  try {
    await fetchJson("/groups/join", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        inviteCode: DEMO_INVITE,
        fullName: "E2E Smoke User",
        phone: MEMBER_PHONE,
        password: "E2eSmokePass123!",
      }),
    });
    ok("member join (or already member)");
  } catch (e) {
    const msg = String(e);
    if (msg.includes("already a member")) {
      ok("member join skipped — already member");
    } else {
      throw e;
    }
  }
  return token;
}

async function flowPaymentReadiness(memberToken) {
  const me = await fetchJson("/member/me", {
    headers: { Authorization: `Bearer ${memberToken}` },
  });
  if (!me?.id && !me?.userId) throw new Error("member/me missing identity");
  ok("member me");

  const groups = await fetchJson("/member/groups", {
    headers: { Authorization: `Bearer ${memberToken}` },
  });
  const memberships = groups?.memberships ?? groups;
  ok(`member groups (${Array.isArray(memberships) ? memberships.length : 0})`);
}

async function flowContributionPayment() {
  const otpReq = await fetchJson("/auth/otp/request", {
    method: "POST",
    body: JSON.stringify({ phone: PAY_TEST_PHONE }),
  });
  const code = otpReq.debugCode;
  if (!code) throw new Error("OTP debugCode missing for payment flow");
  const session = await fetchJson("/auth/otp/verify", {
    method: "POST",
    body: JSON.stringify({ phone: PAY_TEST_PHONE, code }),
  });
  const token = session.access_token ?? session.accessToken;
  if (!token) throw new Error("payment flow: missing token");

  const groups = await fetchJson("/member/groups", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const memberships = groups?.memberships ?? [];
  const payable = memberships.find(
    (m) =>
      m.contributionId &&
      m.contributionStatus === "PENDING" &&
      m.groupStatus === "ACTIVE",
  );
  if (!payable) {
    throw new Error(
      "No ACTIVE group with PENDING contribution — run seed:staging:local (STAGING-PAY)",
    );
  }

  const initiated = await fetchJson(
    `/member/payment-requests/contributions/${payable.contributionId}/initiate`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!initiated?.id) throw new Error("payment initiate missing id");
  ok(`payment initiate ${initiated.id}`);

  const approved = await fetchJson(
    `/member/payment-requests/${initiated.id}/mock-approve`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (approved?.status !== "APPROVED") {
    throw new Error(`mock-approve expected APPROVED, got ${approved?.status}`);
  }
  ok("payment mock-approve APPROVED");
}

async function main() {
  console.log(`\nMyTurn staging smoke @ ${BASE}\n`);

  try {
    await flowHealth();
  } catch (e) {
    fail("health", e);
    console.error("\nIs the API running? Start with: npm run dev:api\n");
    process.exit(1);
  }

  try {
    await flowInvite();
  } catch (e) {
    fail("invite", e);
    if (String(e).includes("Invalid invite code")) {
      console.error(
        "    Hint: run `npm run db:seed` then `npm run seed:staging:local` (local API) or `npm run seed:staging` (Railway DB).",
      );
    }
  }

  try {
    await flowAdminAuth();
  } catch (e) {
    fail("admin auth", e);
  }

  try {
    const memberToken = await flowMemberJoin();
    await flowPaymentReadiness(memberToken);
  } catch (e) {
    fail("member flows", e);
  }

  try {
    await flowContributionPayment();
  } catch (e) {
    fail("contribution payment", e);
  }

  console.log(`\n--- ${passed} passed, ${failed} failed ---\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
