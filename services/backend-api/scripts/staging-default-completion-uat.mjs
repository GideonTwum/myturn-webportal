#!/usr/bin/env node
/**
 * Staging default + completion UAT — guarded script (never production, never wipes DB).
 *
 * Usage:
 *   $env:STAGING_UAT="1"
 *   $env:STAGING_API_URL="https://myturn-webportal-staging.up.railway.app/api"
 *   node services/backend-api/scripts/staging-default-completion-uat.mjs
 *
 * Requires services/backend-api/.env.railway-public for compliance backdate (groupStartDate).
 */
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const { loadPrismaEnv, logDatabaseUrlHost } = require("../load-env.cjs");

const BASE = (process.env.STAGING_API_URL ?? "").replace(/\/+$/, "");
const PASS = "ChangeMe123!";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const report = { env: {}, tests: {}, bugs: [], warnings: [] };

function assertStagingUatAllowed() {
  const tier = (process.env.DEPLOYMENT_TIER ?? "").trim().toLowerCase();
  const uat = process.env.STAGING_UAT === "1" || process.env.STAGING_UAT === "true";
  if (tier === "production") {
    throw new Error("Refusing staging default/completion UAT in production");
  }
  if (!uat && tier !== "staging") {
    throw new Error("Set STAGING_UAT=1 or DEPLOYMENT_TIER=staging");
  }
  if (!BASE) {
    throw new Error("Set STAGING_API_URL");
  }
}

function assertRailwayStagingDb() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error(
      "DATABASE_URL missing — add services/backend-api/.env.railway-public for backdate support",
    );
  }
  const host = new URL(raw.trim().replace(/^postgres(ql)?:/i, "http:")).hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") {
    throw new Error(
      "Refusing local DATABASE_URL — use .env.railway-public staging URL for this script",
    );
  }
  if (tierIsProductionHost(host)) {
    throw new Error(`Refusing DATABASE_URL host that looks like production: ${host}`);
  }
}

function tierIsProductionHost(host) {
  return /prod/i.test(host) && !/staging|stg/i.test(host);
}

async function api(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  const data = json?.data ?? json;
  return { status: res.status, ok: res.ok, data, raw: json };
}

async function login(email) {
  const r = await api("POST", "/auth/login", { body: { email, password: PASS } });
  if (!r.ok) throw new Error(`Login ${email}: ${JSON.stringify(r.raw).slice(0, 200)}`);
  return r.data.access_token ?? r.data.accessToken;
}

async function joinMember(inviteCode, phone, name, suffix) {
  const r = await api("POST", "/groups/join", {
    body: {
      inviteCode,
      fullName: `${name} ${suffix}`,
      phone,
      password: PASS,
    },
  });
  if (!r.ok) throw new Error(`Join ${phone}: ${JSON.stringify(r.raw).slice(0, 200)}`);
  return {
    userId: r.data.userId ?? r.data.sub,
    token: r.data.access_token ?? r.data.accessToken,
    phone,
    email: r.data.email ?? null,
  };
}

async function createUatGroup(adminToken, label, { memberCount = 5, daysPerCycle = 10 } = {}) {
  const ts = Date.now();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 40);
  const created = await api("POST", "/groups", {
    token: adminToken,
    body: {
      name: `${label} ${ts}`,
      contributionAmount: 300,
      groupSize: memberCount,
      payoutMode: "CYCLE",
      daysPerCycle,
      startDate: start.toISOString().slice(0, 10),
      serviceMarginBps: 500,
    },
  });
  if (!created.ok) throw new Error(`Create group: ${JSON.stringify(created.raw).slice(0, 300)}`);
  const group = created.data ?? created.raw;
  return { groupId: group.id, inviteCode: group.inviteCode, ts };
}

async function fillMembers(inviteCode, prefix, count) {
  const members = [];
  for (let i = 1; i <= count; i++) {
    const phone = `0238${String(Date.now() + i).slice(-7)}`;
    members.push(await joinMember(inviteCode, phone, prefix, String(i)));
    await sleep(60);
  }
  return members;
}

async function activateGroup(adminToken, groupId) {
  const act = await api("POST", `/groups/${groupId}/activate`, { token: adminToken });
  if (!act.ok) throw new Error(`Activate: ${JSON.stringify(act.raw).slice(0, 200)}`);
}

async function getContributions(prisma, groupId, cycle) {
  return prisma.contribution.findMany({ where: { groupId, cycleNumber: cycle } });
}

async function payAllDays(adminToken, contribs, days) {
  for (const c of contribs) {
    for (let d = 0; d < days; d++) {
      const r = await api("POST", "/payments/mock/contribution-payment", {
        token: adminToken,
        body: { contributionId: c.id },
      });
      if (!r.ok && r.status !== 400) {
        throw new Error(`Pay ${c.id}: ${JSON.stringify(r.raw).slice(0, 150)}`);
      }
      await sleep(20);
    }
  }
}

async function setGroupStartPast(prisma, groupId, daysAgo) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  const iso = d.toISOString().slice(0, 10);
  await prisma.group.update({
    where: { id: groupId },
    data: { groupStartDate: new Date(`${iso}T12:00:00.000Z`) },
  });
  return iso;
}

async function syncCompliance(adminToken, groupId) {
  return api("GET", `/groups/${groupId}/payout-readiness`, { token: adminToken });
}

async function ledgerBalances(prisma, userId) {
  const accounts = await prisma.ledgerAccount.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { type: { in: ["MYTURN_REVENUE", "GROUP_POOL"] } },
      ],
    },
  });
  const ledger = {};
  for (const a of accounts) {
    const key = a.ownerId ? `${a.type}:${a.ownerId}:${a.currency}` : `${a.type}:${a.currency}`;
    ledger[key] = a.balance.toString();
  }
  return { ledger };
}

async function runPostPayoutDefault(prisma, adminToken, hqToken) {
  const t = { name: "A — Post-payout default", steps: [], checks: {}, pass: true };
  const { groupId, inviteCode } = await createUatGroup(adminToken, "UAT Default PostPayout");
  const members = await fillMembers(inviteCode, "PostDef", 5);
  await activateGroup(adminToken, groupId);
  const recipient = members[0];

  const c1 = await getContributions(prisma, groupId, 1);
  await payAllDays(adminToken, c1, 10);
  const fin1 = await api("POST", "/payouts/mock/finalize-cycle", {
    token: adminToken,
    body: { groupId, cycleNumber: 1 },
  });
  t.steps.push({ step: "finalize cycle 1", ok: fin1.ok, status: fin1.status });
  if (!fin1.ok) {
    t.pass = false;
    report.tests.postPayoutDefault = t;
    return;
  }

  const reserve = await prisma.contributionGuaranteeReserve.findFirst({
    where: { userId: recipient.userId, groupId },
  });
  const balAfter = await ledgerBalances(prisma, recipient.userId);
  t.steps.push({
    step: "post-payout reserve",
    reserveBps: reserve?.reserveBps ?? null,
    original: reserve?.originalReserveAmount?.toString() ?? null,
    remaining: reserve?.remainingReserveAmount?.toString() ?? null,
    reservedLedger: balAfter.ledger[`MEMBER_WALLET_RESERVED:${recipient.userId}:GHS`] ?? "0",
  });

  const c2 = await getContributions(prisma, groupId, 2);
  const others = c2.filter((c) => c.userId !== recipient.userId);
  await payAllDays(adminToken, others, 10);
  await setGroupStartPast(prisma, groupId, 55);
  await syncCompliance(adminToken, groupId);
  await syncCompliance(adminToken, groupId);

  const member = await prisma.groupMember.findFirst({
    where: { groupId, userId: recipient.userId },
  });
  const cov = await prisma.defaultCoverage.findMany({
    where: { userId: recipient.userId, groupId },
  });
  const balAfterDefault = await ledgerBalances(prisma, recipient.userId);
  const notif = await prisma.notification.findMany({
    where: {
      userId: recipient.userId,
      type: { in: ["CYCLE_DEFAULTED", "RESERVE_USED_FOR_DEFAULT"] },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const wd = await api("POST", "/member/withdrawals", {
    token: recipient.token,
    body: { amount: "1.00", momoNumber: "233241234567" },
  });
  const recon = await api("GET", "/hq/reconciliation/summary", { token: hqToken });

  t.steps.push({
    step: "after default",
    cycleStanding: member?.cycleStanding,
    defaultCoverageCount: cov.length,
    reservedAfter: balAfterDefault.ledger[`MEMBER_WALLET_RESERVED:${recipient.userId}:GHS`],
    withdrawalBlocked: wd.status === 400,
    reconciliation: recon.data?.status ?? recon.status,
    notifications: notif.map((n) => n.type),
  });

  t.checks = {
    reserveCreated: !!reserve && Number(reserve.originalReserveAmount) > 0,
    defaultedOrCovered:
      member?.cycleStanding === "DEFAULTED" ||
      member?.cycleStanding === "ACTIVE" ||
      cov.length > 0,
    reserveCoverJournal: cov.length >= 1,
    withdrawalBlocked: wd.status === 400,
    reconciliationOk: recon.data?.status === "ok",
  };
  if (!t.checks.reserveCreated) {
    report.bugs.push({ test: "PostPayoutDefault", issue: "No reserve after payout" });
    t.pass = false;
  }
  report.tests.postPayoutDefault = t;
}

async function runPrePayoutDefault(prisma, adminToken) {
  const t = { name: "B — Pre-payout default", steps: [], checks: {}, pass: true };
  const { groupId, inviteCode } = await createUatGroup(adminToken, "UAT Default PrePayout");
  const members = await fillMembers(inviteCode, "PreDef", 5);
  await activateGroup(adminToken, groupId);
  const prePayoutMember = members[3];

  const c1 = await getContributions(prisma, groupId, 1);
  await payAllDays(adminToken, c1, 10);
  await api("POST", "/payouts/mock/finalize-cycle", {
    token: adminToken,
    body: { groupId, cycleNumber: 1 },
  });

  const c2 = await getContributions(prisma, groupId, 2);
  const others = c2.filter((c) => c.userId !== prePayoutMember.userId);
  await payAllDays(adminToken, others, 10);
  await setGroupStartPast(prisma, groupId, 55);
  await syncCompliance(adminToken, groupId);

  const member = await prisma.groupMember.findFirst({
    where: { groupId, userId: prePayoutMember.userId },
  });
  const readiness = await syncCompliance(adminToken, groupId);
  const fin2 = await api("POST", "/payouts/mock/finalize-cycle", {
    token: adminToken,
    body: { groupId, cycleNumber: 2 },
  });
  const payout2 = await prisma.payout.findFirst({ where: { groupId, cycleNumber: 2 } });

  const wd = await api("POST", "/member/withdrawals", {
    token: prePayoutMember.token,
    body: { amount: "1.00", momoNumber: "233241234567" },
  });
  const join = await api("POST", "/groups/join", {
    token: prePayoutMember.token,
    body: {
      inviteCode: "INVALID-CODE",
      fullName: "Blocked Join",
      phone: prePayoutMember.phone,
      password: PASS,
    },
  });

  t.steps.push({
    step: "pre-payout default outcome",
    cycleStanding: member?.cycleStanding,
    effectivePayoutOrder: member?.effectivePayoutOrder,
    finalizeCycle2: { ok: fin2.ok, status: fin2.status },
    payout2Recipient: payout2?.recipientId?.slice(-6) ?? null,
    allPaid: readiness.data?.allPaid ?? readiness.raw?.allPaid,
    withdrawalBlocked: wd.status === 400,
    joinBlocked: join.status === 400,
  });

  t.checks = {
    defaulted: member?.cycleStanding === "DEFAULTED",
    orderAtEnd: (member?.effectivePayoutOrder ?? 0) >= 5,
    cycle2Finalized: fin2.ok,
    payoutToOther: payout2 && payout2.recipientId !== prePayoutMember.userId,
    withdrawalBlocked: wd.status === 400,
    joinBlocked: join.status === 400,
  };
  if (!t.checks.cycle2Finalized) {
    report.bugs.push({ test: "PrePayoutDefault", issue: "Could not finalize cycle 2" });
    t.pass = false;
  }
  report.tests.prePayoutDefault = t;
}

async function runRecovery(prisma, adminToken) {
  const t = { name: "C — Recovery", steps: [], checks: {}, pass: true };
  const { groupId, inviteCode } = await createUatGroup(adminToken, "UAT Recovery");
  const members = await fillMembers(inviteCode, "Recovery", 5);
  await activateGroup(adminToken, groupId);
  const defaulter = members[0];

  const c1 = await getContributions(prisma, groupId, 1);
  await payAllDays(adminToken, c1, 10);
  await api("POST", "/payouts/mock/finalize-cycle", {
    token: adminToken,
    body: { groupId, cycleNumber: 1 },
  });

  const c2 = await getContributions(prisma, groupId, 2);
  const others = c2.filter((c) => c.userId !== defaulter.userId);
  await payAllDays(adminToken, others, 10);
  await setGroupStartPast(prisma, groupId, 55);
  await syncCompliance(adminToken, groupId);

  const defaulterContrib = c2.find((c) => c.userId === defaulter.userId);
  await api("POST", "/payments/mock/contribution-payment", {
    token: adminToken,
    body: { contributionId: defaulterContrib.id },
  });
  await syncCompliance(adminToken, groupId);
  const mid = await prisma.groupMember.findFirst({
    where: { groupId, userId: defaulter.userId },
  });

  for (let i = 1; i < 10; i++) {
    await api("POST", "/payments/mock/contribution-payment", {
      token: adminToken,
      body: { contributionId: defaulterContrib.id },
    });
  }
  await syncCompliance(adminToken, groupId);
  const after = await prisma.groupMember.findFirst({
    where: { groupId, userId: defaulter.userId },
  });

  const wallet = await api("GET", "/member/wallet", { token: defaulter.token });
  const wd = await api("POST", "/member/withdrawals", {
    token: defaulter.token,
    body: { amount: "1.00", momoNumber: "233241234567" },
  });

  t.steps.push({
    afterPartialStanding: mid?.cycleStanding,
    afterFullStanding: after?.cycleStanding,
    effectivePayoutOrder: after?.effectivePayoutOrder,
    withdrawalAfterResolve: { ok: wd.ok, status: wd.status },
    available: wallet.data?.availableBalance,
  });

  t.checks = {
    resolvedToActive: after?.cycleStanding === "ACTIVE",
    effectiveOrderStillAtEnd: (after?.effectivePayoutOrder ?? 0) > 1,
    withdrawalAllowed: wd.ok || wd.status !== 400,
  };
  report.tests.recovery = t;
}

async function runCompletion(prisma, adminToken, hqToken) {
  const t = { name: "D — Group completion", steps: [], checks: {}, pass: true };
  const ts = Date.now();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 60);
  const created = await api("POST", "/groups", {
    token: adminToken,
    body: {
      name: `UAT Completion ${ts}`,
      contributionAmount: 100,
      groupSize: 5,
      payoutMode: "CYCLE",
      daysPerCycle: 3,
      startDate: start.toISOString().slice(0, 10),
      serviceMarginBps: 500,
    },
  });
  const groupId = created.data?.id ?? created.raw?.id;
  const inviteCode = created.data?.inviteCode ?? created.raw?.inviteCode;
  if (!groupId || !inviteCode) throw new Error("Create completion group missing id/invite");
  const members = await fillMembers(inviteCode, "Complete", 5);
  await activateGroup(adminToken, groupId);
  await prisma.group.update({
    where: { id: groupId },
    data: { groupStartDate: new Date(`${start.toISOString().slice(0, 10)}T12:00:00.000Z`) },
  });

  for (let cycle = 1; cycle <= 5; cycle++) {
    const contribs = await getContributions(prisma, groupId, cycle);
    await payAllDays(adminToken, contribs, 3);
    const fin = await api("POST", "/payouts/mock/finalize-cycle", {
      token: adminToken,
      body: { groupId, cycleNumber: cycle },
    });
    t.steps.push({ cycle, finalizeOk: fin.ok, status: fin.status });
    if (!fin.ok && cycle < 5) {
      t.pass = false;
      report.tests.completion = t;
      return;
    }
  }

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  const reserves = await prisma.contributionGuaranteeReserve.findMany({ where: { groupId } });
  const finDup = await api("POST", "/payouts/mock/finalize-cycle", {
    token: adminToken,
    body: { groupId, cycleNumber: 5 },
  });
  const payoutCount = await prisma.payout.count({ where: { groupId } });
  const recipient0 = members[0];
  const bal = await ledgerBalances(prisma, recipient0.userId);
  const wallet = await api("GET", "/member/wallet", { token: recipient0.token });
  const recon = await api("GET", "/hq/reconciliation/summary", { token: hqToken });

  t.steps.push({
    groupStatus: group?.status,
    reservesReleased: reserves.every((r) => r.status === "RELEASED"),
    reservedLedger: bal.ledger[`MEMBER_WALLET_RESERVED:${recipient0.userId}:GHS`] ?? "0",
    walletReserved: wallet.data?.reservedBalance,
    doubleFinalizeBlocked: !finDup.ok,
    payoutCount,
    reconciliation: recon.data?.status,
  });

  t.checks = {
    completed: group?.status === "COMPLETED",
    allReservesReleased: reserves.every((r) => r.status === "RELEASED"),
    noExtraPayouts: payoutCount === 5,
    idempotentFinalize: !finDup.ok,
    reconciliationOk: recon.data?.status === "ok",
  };
  if (!t.checks.completed) {
    report.bugs.push({ test: "Completion", issue: "Group not COMPLETED" });
    t.pass = false;
  }
  report.tests.completion = t;
}

async function main() {
  assertStagingUatAllowed();
  loadPrismaEnv(packageRoot);
  assertRailwayStagingDb();
  logDatabaseUrlHost("[staging-default-completion-uat]");

  report.env = {
    api: BASE,
    deploymentTier: process.env.DEPLOYMENT_TIER ?? "(unset)",
    stagingUat: process.env.STAGING_UAT ?? "(unset)",
  };

  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (e) {
    console.error(
      "Cannot reach staging DATABASE_URL from this machine (needed for groupStartDate backdate).",
    );
    console.error(e instanceof Error ? e.message : e);
    console.error("Retry when Railway public Postgres is reachable, or run from CI.");
    process.exit(1);
  }
  try {
    const adminToken = await login("admin@myturn.local");
    const hqToken = await login("hq@myturn.local");

    const only = process.env.STAGING_UAT_SCENARIOS?.split(",") ?? [
      "postPayoutDefault",
      "prePayoutDefault",
      "recovery",
      "completion",
    ];

    if (only.includes("postPayoutDefault")) {
      await runPostPayoutDefault(prisma, adminToken, hqToken);
    }
    if (only.includes("prePayoutDefault")) {
      await runPrePayoutDefault(prisma, adminToken);
    }
    if (only.includes("recovery")) {
      await runRecovery(prisma, adminToken);
    }
    if (only.includes("completion")) {
      await runCompletion(prisma, adminToken, hqToken);
    }

    console.log(JSON.stringify(report, null, 2));
    const failed = Object.values(report.tests).some((t) => t.pass === false);
    const bugCount = report.bugs.length;
    if (failed || bugCount > 0) {
      console.error(`\nCompleted with ${bugCount} bug(s); some checks failed.`);
      process.exitCode = 1;
    } else {
      console.log("\nAll default/completion scenarios passed.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
