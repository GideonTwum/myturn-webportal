/**
 * Local chaos financial tests — read-only audit harness.
 * Usage: node scripts/chaos-local-financial.mjs
 * Requires: dev:api on localhost:3001, local DATABASE_URL
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const API = "http://localhost:3001/api";
const PASSWORD = "ChangeMe123!";
const prisma = new PrismaClient();

const report = { env: {}, tests: {}, bugs: [], warnings: [] };

function loadEnv() {
  const raw = readFileSync(resolve(__dirname, "../.env"), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
  return env;
}

function assertLocalDb(url) {
  if (!url) throw new Error("DATABASE_URL missing");
  const host = new URL(url.replace(/^postgres(ql)?:/i, "http:")).hostname.toLowerCase();
  if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
    throw new Error(`DATABASE_URL not local: ${host}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, path, { token, body } = {}, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${API}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      const data = json?.data ?? json;
      return { status: res.status, ok: res.ok, data, raw: json };
    } catch (e) {
      if (i === retries - 1) throw e;
      await sleep(400 * (i + 1));
    }
  }
  throw new Error("unreachable");
}

async function login(email) {
  const r = await api("POST", "/auth/login", {
    body: { email, password: PASSWORD },
  });
  if (!r.ok) throw new Error(`Login failed ${email}: ${JSON.stringify(r.raw)}`);
  return r.data.access_token ?? r.data.accessToken;
}

async function ensureChaosUsers() {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const users = [];
  for (let i = 1; i <= 5; i++) {
    const email = `chaos.m${i}@myturn.local`;
    const phone = `0249${String(i).padStart(7, "0")}`;
    const u = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        passwordHash: hash,
        role: "USER",
        firstName: `Chaos`,
        lastName: `M${i}`,
        phone,
        isActive: true,
      },
      update: { isActive: true },
    });
    users.push(u);
  }
  return users;
}

async function ledgerBalances(userId, groupId) {
  const keys = [
    `MEMBER_WALLET_AVAILABLE:${userId}:GHS`,
    `MEMBER_WALLET_RESERVED:${userId}:GHS`,
    `MEMBER_DEPOSIT_ESCROW:${userId}:GHS`,
    `GROUP_POOL:${groupId}:GHS`,
    `MYTURN_REVENUE:GHS`,
    `WITHDRAWAL_CLEARING:GHS`,
    `PLATFORM_FLOAT:GHS`,
    `SYSTEM_EXTERNAL:GHS`,
  ];
  const rows = await prisma.ledgerAccount.findMany({
    where: { accountKey: { in: keys } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.accountKey, r.balance.toString()]));
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  return { ledger: map, wallet: wallet ? { balance: wallet.balance.toString(), locked: wallet.lockedBalance.toString() } : null };
}

async function payAllDays(adminToken, contributions, days) {
  for (const c of contributions) {
    for (let d = 0; d < days; d++) {
      const r = await api("POST", "/payments/mock/contribution-payment", {
        token: adminToken,
        body: { contributionId: c.id },
      });
      if (!r.ok && r.status !== 400) throw new Error(`Pay failed: ${JSON.stringify(r.raw)}`);
      await sleep(25);
    }
  }
}

async function getContributions(groupId, cycle) {
  return prisma.contribution.findMany({ where: { groupId, cycleNumber: cycle } });
}

async function syncCompliance(adminToken, groupId) {
  return api("GET", `/groups/${groupId}/payout-readiness`, { token: adminToken });
}

async function setGroupStartPast(groupId, daysAgo) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  const iso = d.toISOString().slice(0, 10);
  await prisma.group.update({
    where: { id: groupId },
    data: { groupStartDate: new Date(`${iso}T12:00:00.000Z`) },
  });
  return iso;
}

async function createChaosGroup(adminToken, adminId, users, suffix, startDaysAgo = 40) {
  const startIso = await (async () => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - startDaysAgo);
    return d.toISOString().slice(0, 10);
  })();
  const created = await api("POST", "/groups", {
    token: adminToken,
    body: {
      name: `Chaos ${suffix}`,
      contributionAmount: 300,
      groupSize: 5,
      payoutMode: "CYCLE",
      daysPerCycle: 10,
      startDate: startIso,
      serviceMarginBps: 500,
    },
  });
  if (!created.ok) throw new Error(`Create group failed: ${JSON.stringify(created.raw)}`);
  const groupId = created.data?.id ?? created.raw?.id;
  if (!groupId) throw new Error(`Create group missing id: ${JSON.stringify(created.raw)}`);
  for (let i = 0; i < users.length; i++) {
    await api("POST", `/groups/${groupId}/members`, {
      token: adminToken,
      body: { userId: users[i].id, turnOrder: i + 1 },
    });
  }
  const act = await api("POST", `/groups/${groupId}/activate`, { token: adminToken });
  if (!act.ok) throw new Error(`Activate failed: ${JSON.stringify(act.raw)}`);
  await prisma.group.update({
    where: { id: groupId },
    data: { groupStartDate: new Date(`${startIso}T12:00:00.000Z`) },
  });
  return { groupId, startIso };
}

async function runTestA(adminToken, users) {
  const t = { name: "A — Post-payout default", steps: [], pass: true };
  const { groupId } = await createChaosGroup(adminToken, null, users, "PostPayout");
  const recipient = users[0];
  const c1 = await getContributions(groupId, 1);
  await payAllDays(adminToken, c1, 10);
  const fin1 = await api("POST", "/payouts/mock/finalize-cycle", {
    token: adminToken,
    body: { groupId, cycleNumber: 1 },
  });
  t.steps.push({ step: "finalize cycle 1", status: fin1.status, ok: fin1.ok });
  if (!fin1.ok) { t.pass = false; report.tests.A = t; return; }

  const reserve = await prisma.contributionGuaranteeReserve.findFirst({
    where: { userId: recipient.id, groupId },
  });
  const balAfterPayout = await ledgerBalances(recipient.id, groupId);
  t.steps.push({
    step: "post-payout balances",
    reserve: reserve ? {
      original: reserve.originalReserveAmount.toString(),
      remaining: reserve.remainingReserveAmount.toString(),
      bps: reserve.reserveBps,
    } : null,
    available: balAfterPayout.ledger[`MEMBER_WALLET_AVAILABLE:${recipient.id}:GHS`] ?? "0",
    reserved: balAfterPayout.ledger[`MEMBER_WALLET_RESERVED:${recipient.id}:GHS`] ?? "0",
    revenue: balAfterPayout.ledger["MYTURN_REVENUE:GHS"] ?? "0",
  });

  const c2 = await getContributions(groupId, 2);
  const others = c2.filter((c) => c.userId !== recipient.id);
  await payAllDays(adminToken, others, 10);
  await setGroupStartPast(groupId, 50);
  const beforeDefault = await ledgerBalances(recipient.id, groupId);
  await syncCompliance(adminToken, groupId);
  await syncCompliance(adminToken, groupId);

  const member = await prisma.groupMember.findFirst({ where: { groupId, userId: recipient.id } });
  const cov = await prisma.defaultCoverage.findMany({ where: { userId: recipient.id, groupId } });
  const afterDefault = await ledgerBalances(recipient.id, groupId);
  const notif = await prisma.notification.findMany({
    where: { userId: recipient.id, type: { in: ["CYCLE_DEFAULTED", "RESERVE_USED_FOR_DEFAULT"] } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  const audit = await prisma.auditLog.findMany({
    where: { action: { contains: "DEFAULT" } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const memberToken = await login(recipient.email);
  const wd = await api("POST", "/member/withdrawals", {
    token: memberToken,
    body: { amount: "1.00", momoNumber: "233241234567" },
  });
  const join = await api("POST", "/groups/join", {
    token: memberToken,
    body: {
      inviteCode: "DOESNOTEXIST",
      fullName: "Chaos Join",
      phone: recipient.phone ?? "02490000001",
      password: PASSWORD,
    },
  });

  const fin2Attempt = await api("POST", "/payouts/mock/finalize-cycle", {
    token: adminToken,
    body: { groupId, cycleNumber: 2 },
  });

  t.steps.push({
    step: "after default",
    cycleStanding: member?.cycleStanding,
    defaultedAt: member?.defaultedAt?.toISOString() ?? null,
    defaultCoverageCount: cov.length,
    defaultCoverage: cov.map((x) => ({
      covered: x.coveredAmount.toString(),
      missed: x.missedAmount.toString(),
      key: x.idempotencyKey,
    })),
    reservedBefore: beforeDefault.ledger[`MEMBER_WALLET_RESERVED:${recipient.id}:GHS`],
    reservedAfter: afterDefault.ledger[`MEMBER_WALLET_RESERVED:${recipient.id}:GHS`],
    availableAfter: afterDefault.ledger[`MEMBER_WALLET_AVAILABLE:${recipient.id}:GHS`],
    withdrawalBlocked: wd.status === 400,
    withdrawalError: wd.raw?.message ?? wd.data?.message,
    joinBlocked: join.status === 400,
    joinError: join.raw?.message ?? join.data?.message,
    finalizeCycle2: { status: fin2Attempt.status, ok: fin2Attempt.ok, msg: fin2Attempt.raw?.message },
    notifications: notif.map((n) => ({ type: n.type, title: n.title })),
    auditSample: audit.map((a) => a.action),
  });

  const reservedDecreased =
    Number(afterDefault.ledger[`MEMBER_WALLET_RESERVED:${recipient.id}:GHS`] ?? 0) <
    Number(beforeDefault.ledger[`MEMBER_WALLET_RESERVED:${recipient.id}:GHS`] ?? 0);
  const availableUnchanged =
    afterDefault.ledger[`MEMBER_WALLET_AVAILABLE:${recipient.id}:GHS`] ===
    beforeDefault.ledger[`MEMBER_WALLET_AVAILABLE:${recipient.id}:GHS`];

  t.checks = {
    defaulted: member?.cycleStanding === "DEFAULTED",
    reserveCoverRecorded: cov.length >= 1,
    noDoubleCover: cov.length <= 1,
    reservedDecreased,
    availableNotIncreasedByCover: availableUnchanged,
    withdrawalBlocked: wd.status === 400,
    joinBlocked: join.status === 400,
  };
  if (!t.checks.defaulted && member?.cycleStanding === "ACTIVE") {
    report.warnings.push("Test A: member resolved to ACTIVE after full reserve cover (may be by design)");
  }
  report.tests.A = t;
}

async function runTestB(adminToken, users) {
  const t = { name: "B — Pre-payout default", steps: [], pass: true };
  const { groupId } = await createChaosGroup(adminToken, null, users, "PrePayout");
  const prePayoutMember = users[3];
  const c1 = await getContributions(groupId, 1);
  await payAllDays(adminToken, c1, 10);
  await api("POST", "/payouts/mock/finalize-cycle", {
    token: adminToken,
    body: { groupId, cycleNumber: 1 },
  });

  const c2 = await getContributions(groupId, 2);
  const preContrib = c2.find((c) => c.userId === prePayoutMember.id);
  const others = c2.filter((c) => c.userId !== prePayoutMember.id);
  await payAllDays(adminToken, others, 10);
  await setGroupStartPast(groupId, 50);
  await syncCompliance(adminToken, groupId);

  const member = await prisma.groupMember.findFirst({
    where: { groupId, userId: prePayoutMember.id },
  });
  const allMembers = await prisma.groupMember.findMany({
    where: { groupId, status: "ACTIVE" },
    orderBy: { effectivePayoutOrder: "asc" },
  });
  const readiness = await syncCompliance(adminToken, groupId);
  const fin2 = await api("POST", "/payouts/mock/finalize-cycle", {
    token: adminToken,
    body: { groupId, cycleNumber: 2 },
  });
  const payout2 = await prisma.payout.findFirst({ where: { groupId, cycleNumber: 2 } });
  const cov = await prisma.defaultCoverage.findFirst({
    where: { userId: prePayoutMember.id, groupId },
  });

  t.steps.push({
    cycleStanding: member?.cycleStanding,
    effectivePayoutOrder: member?.effectivePayoutOrder,
    turnOrder: member?.turnOrder,
    queue: allMembers.map((m) => ({
      userId: m.userId.slice(-4),
      turn: m.turnOrder,
      effective: m.effectivePayoutOrder,
      standing: m.cycleStanding,
    })),
    expectedRecipient: readiness.data?.expectedPayoutRecipient,
    skipped: readiness.data?.skippedDefaultedRecipients,
    finalizeOk: fin2.ok,
    finalizeStatus: fin2.status,
    finalizeMsg: fin2.raw?.message,
    payoutRecipientId: payout2?.recipientId,
    prePayoutMemberId: prePayoutMember.id,
    reserveCover: !!cov,
    audit: await prisma.auditLog.findMany({
      where: { action: "PAYOUT_TURN_SKIPPED_DEFAULTED_MEMBER", entityType: "Payout" },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
  });

  const payoutCount = await prisma.payout.count({ where: { groupId } });
  t.checks = {
    defaulted: member?.cycleStanding === "DEFAULTED",
    dequeued: (member?.effectivePayoutOrder ?? 0) > member?.turnOrder,
    noReserveCover: !cov,
    finalizeSucceeded: fin2.ok,
    skippedDefaulted: payout2 && payout2.recipientId !== prePayoutMember.id,
    noDuplicatePayouts: payoutCount === 2,
  };
  if (!fin2.ok) {
    report.bugs.push({
      test: "B",
      severity: "High",
      issue: "Cannot finalize cycle when pre-payout defaulted member has unpaid contribution",
      detail: fin2.raw?.message,
    });
  }
  report.tests.B = t;
}

async function runTestC(adminToken, users) {
  const t = { name: "C — Recovery", steps: [] };
  const { groupId } = await createChaosGroup(adminToken, null, users, "Recovery");
  const defaulter = users[0];
  const c1 = await getContributions(groupId, 1);
  await payAllDays(adminToken, c1, 10);
  await api("POST", "/payouts/mock/finalize-cycle", {
    token: adminToken,
    body: { groupId, cycleNumber: 1 },
  });
  const c2 = await getContributions(groupId, 2);
  const others = c2.filter((c) => c.userId !== defaulter.id);
  await payAllDays(adminToken, others, 10);
  await setGroupStartPast(groupId, 50);
  await syncCompliance(adminToken, groupId);

  const before = await prisma.groupMember.findFirst({ where: { groupId, userId: defaulter.id } });
  const defaulterContrib = c2.find((c) => c.userId === defaulter.id);
  const partial = await api("POST", "/payments/mock/contribution-payment", {
    token: adminToken,
    body: { contributionId: defaulterContrib.id },
  });
  await syncCompliance(adminToken, groupId);
  const mid = await prisma.groupMember.findFirst({ where: { groupId, userId: defaulter.id } });

  for (let i = 1; i < 10; i++) {
    await api("POST", "/payments/mock/contribution-payment", {
      token: adminToken,
      body: { contributionId: defaulterContrib.id },
    });
  }
  await syncCompliance(adminToken, groupId);
  const after = await prisma.groupMember.findFirst({ where: { groupId, userId: defaulter.id } });

  const token = await login(defaulter.email);
  const wallet = await api("GET", "/member/wallet", { token });
  const wd = await api("POST", "/member/withdrawals", {
    token,
    body: { amount: "1.00", momoNumber: "233241234567" },
  });

  t.steps.push({
    beforeStanding: before?.cycleStanding,
    afterPartialStanding: mid?.cycleStanding,
    afterFullStanding: after?.cycleStanding,
    resolvedAt: after?.resolvedAt?.toISOString(),
    effectivePayoutOrder: after?.effectivePayoutOrder,
    withdrawalAfterResolve: { status: wd.status, ok: wd.ok },
    available: wallet.data?.availableBalance,
  });
  t.checks = {
    resolvedToActive: after?.cycleStanding === "ACTIVE",
    effectiveOrderStillAtEnd: (after?.effectivePayoutOrder ?? 0) > 1,
    withdrawalAllowed: wd.ok || wd.status !== 400,
  };
  report.tests.C = t;
}

async function runTestD(adminToken, users) {
  const t = { name: "D — Group completion", steps: [] };
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 60);
  const startIso = d.toISOString().slice(0, 10);
  const created = await api("POST", "/groups", {
    token: adminToken,
    body: {
      name: "Chaos GroupComplete",
      contributionAmount: 100,
      groupSize: 5,
      payoutMode: "CYCLE",
      daysPerCycle: 3,
      startDate: startIso,
      serviceMarginBps: 500,
    },
  });
  const groupId = created.data?.id ?? created.raw?.id;
  if (!groupId) throw new Error(`Create group D missing id: ${JSON.stringify(created.raw)}`);
  for (let i = 0; i < users.length; i++) {
    await api("POST", `/groups/${groupId}/members`, {
      token: adminToken,
      body: { userId: users[i].id, turnOrder: i + 1 },
    });
  }
  await api("POST", `/groups/${groupId}/activate`, { token: adminToken });
  await prisma.group.update({
    where: { id: groupId },
    data: { groupStartDate: new Date(`${startIso}T12:00:00.000Z`) },
  });

  for (let cycle = 1; cycle <= 5; cycle++) {
    const contribs = await getContributions(groupId, cycle);
    await payAllDays(adminToken, contribs, 3);
    const fin = await api("POST", "/payouts/mock/finalize-cycle", {
      token: adminToken,
      body: { groupId, cycleNumber: cycle },
    });
    t.steps.push({ cycle, finalize: fin.ok, status: fin.status });
    if (!fin.ok && cycle < 5) throw new Error(`Cycle ${cycle} finalize failed`);
  }

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  const reserves = await prisma.contributionGuaranteeReserve.findMany({ where: { groupId } });
  const finTwice = await api("POST", "/payouts/mock/finalize-cycle", {
    token: adminToken,
    body: { groupId, cycleNumber: 5 },
  });
  const payoutCount = await prisma.payout.count({ where: { groupId } });
  const recipient0 = users[0];
  const bal = await ledgerBalances(recipient0.id, groupId);
  const token = await login(recipient0.email);
  const wallet = await api("GET", "/member/wallet", { token });

  t.steps.push({
    groupStatus: group?.status,
    reserves: reserves.map((r) => ({
      userId: r.userId.slice(-4),
      status: r.status,
      remaining: r.remainingReserveAmount.toString(),
    })),
    doubleFinalizeBlocked: !finTwice.ok,
    payoutCount,
    reservedLedger: bal.ledger[`MEMBER_WALLET_RESERVED:${recipient0.id}:GHS`],
    walletSummary: {
      available: wallet.data?.availableBalance,
      reserved: wallet.data?.reservedBalance,
    },
  });
  t.checks = {
    completed: group?.status === "COMPLETED",
    allReservesReleased: reserves.every((r) => r.status === "RELEASED"),
    idempotentFinalize: !finTwice.ok,
    noExtraPayouts: payoutCount === 5,
  };
  report.tests.D = t;
}

async function runBonusDeposit(adminToken, users) {
  const t = { name: "Bonus — Security deposit / legacy wallet", steps: [] };
  const u = users[4];
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 30);
  const startIso = d.toISOString().slice(0, 10);
  const created = await api("POST", "/groups", {
    token: adminToken,
    body: {
      name: "Chaos Deposit",
      contributionAmount: 50,
      groupSize: 5,
      payoutMode: "CYCLE",
      daysPerCycle: 3,
      startDate: startIso,
      serviceMarginBps: 500,
    },
  });
  const groupId = created.data?.id ?? created.raw?.id;
  if (!groupId) throw new Error(`Create bonus group missing id: ${JSON.stringify(created.raw)}`);
  for (let i = 0; i < 5; i++) {
    await api("POST", `/groups/${groupId}/members`, {
      token: adminToken,
      body: { userId: users[i].id, turnOrder: i + 1 },
    });
  }
  await api("POST", `/groups/${groupId}/activate`, { token: adminToken });

  const member = await prisma.groupMember.findFirst({ where: { groupId, userId: u.id } });
  const before = await ledgerBalances(u.id, groupId);

  for (let cycle = 1; cycle <= 5; cycle++) {
    const contribs = await getContributions(groupId, cycle);
    await payAllDays(adminToken, contribs, 3);
    await api("POST", "/payouts/mock/finalize-cycle", {
      token: adminToken,
      body: { groupId, cycleNumber: cycle },
    });
  }

  const after = await ledgerBalances(u.id, groupId);
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  const token = await login(u.email);
  const wallet = await api("GET", "/member/wallet", { token });
  const avail = Number(wallet.data?.availableBalance ?? 0);
  const wd = await api("POST", "/member/withdrawals", {
    token,
    body: { amount: String(Math.min(avail, 10).toFixed(2)), momoNumber: "233241234567" },
  });

  t.steps.push({
    depositStatus: member?.depositStatus,
    depositAmount: member?.depositAmount.toString(),
    groupStatus: group?.status,
    walletBefore: before.wallet,
    walletAfter: after.wallet,
    ledgerAvailable: after.ledger[`MEMBER_WALLET_AVAILABLE:${u.id}:GHS`],
    ledgerReserved: after.ledger[`MEMBER_WALLET_RESERVED:${u.id}:GHS`],
    apiAvailable: wallet.data?.availableBalance,
    apiReserved: wallet.data?.reservedBalance,
    withdrawalAttempt: { ok: wd.ok, status: wd.status },
  });

  const legacyBal = Number(after.wallet?.balance ?? 0);
  const ledgerAvail = Number(after.ledger[`MEMBER_WALLET_AVAILABLE:${u.id}:GHS`] ?? 0);
  const mismatch = Math.abs(legacyBal - ledgerAvail) > 0.01 && member?.depositStatus === "RELEASED";
  if (mismatch) {
    report.bugs.push({
      test: "Bonus",
      severity: "Critical",
      issue: "Legacy Wallet.balance disagrees with MEMBER_WALLET_AVAILABLE after deposit release",
      detail: { legacyBal, ledgerAvail, wallet: after.wallet },
    });
  }
  report.tests.Bonus = t;
}

async function reconciliation(hqToken) {
  const r = await api("GET", "/hq/reconciliation/summary", { token: hqToken });
  report.reconciliation = r.data;
}

async function main() {
  const env = loadEnv();
  assertLocalDb(env.DATABASE_URL);
  report.env = {
    databaseHost: new URL(env.DATABASE_URL.replace(/^postgres(ql)?:/i, "http:")).hostname,
    contributionReserveEnabled: env.CONTRIBUTION_RESERVE_ENABLED,
    withdrawalMaxSingle: env.WITHDRAWAL_MAX_SINGLE_AMOUNT ?? "(unset)",
    reserveMaxAmount: env.CONTRIBUTION_RESERVE_MAX_AMOUNT ?? "(unset)",
    paymentProvider: env.PAYMENT_PROVIDER ?? "mock",
    disbursementProvider: env.DISBURSEMENT_PROVIDER ?? "(default mock)",
    mockPayments: env.MOCK_PAYMENTS,
  };

  const health = await api("GET", "/health");
  if (!health.ok) throw new Error("API not reachable at localhost:3001");

  const adminToken = await login("admin@myturn.local");
  const hqToken = await login("hq@myturn.local");
  const users = await ensureChaosUsers();
  const only = process.env.CHAOS_TEST?.split(",") ?? ["A", "B", "C", "D", "Bonus"];

  if (only.includes("A")) await runTestA(adminToken, users);
  if (only.includes("B")) await runTestB(adminToken, users);
  if (only.includes("C")) await runTestC(adminToken, users);
  if (only.includes("D")) await runTestD(adminToken, users);
  if (only.includes("Bonus")) await runBonusDeposit(adminToken, users);
  if (only.includes("Recon")) await reconciliation(hqToken);
  if (!process.env.CHAOS_TEST) await reconciliation(hqToken);

  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
