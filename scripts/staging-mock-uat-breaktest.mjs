#!/usr/bin/env node
/**
 * Staging Mock UAT break-test — API-only (no direct DB).
 * Usage: STAGING_API_URL=https://... node scripts/staging-mock-uat-breaktest.mjs
 */
const BASE = (process.env.STAGING_API_URL ?? "").replace(/\/+$/, "");
const PASS = "ChangeMe123!";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const findings = [];
let adminToken, hqToken;

function bug(id, area, severity, what, expected, actual, evidence, fix, beforeMtn, beforeUsers) {
  findings.push({ id, area, severity, what, expected, actual, evidence, fix, beforeMtn, beforeUsers });
}

function log(msg) {
  console.log(msg);
}

async function api(method, path, { token, body, headers } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
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
  };
}

async function mockPayContribution(token, contributionId) {
  return api("POST", "/payments/mock/contribution-payment", {
    token,
    body: { contributionId },
  });
}

async function memberPayFlow(token, contributionId) {
  const init = await api("POST", `/member/payment-requests/contributions/${contributionId}/initiate`, {
    token,
  });
  if (!init.ok) return init;
  const hint = init.data?.mockApproveHint ?? init.raw?.mockApproveHint;
  if (!hint) return { ...init, ok: false, note: "no mockApproveHint" };
  const reqId = init.data?.id ?? init.raw?.id;
  return api("POST", `/member/payment-requests/${reqId}/mock-approve`, { token });
}

async function getReconciliation() {
  return api("GET", "/hq/reconciliation/summary", { token: hqToken });
}

async function getLedgerTx(search) {
  return api("GET", `/hq/ledger/transactions?limit=10&search=${encodeURIComponent(search)}`, {
    token: hqToken,
  });
}

/** Extract wallet allocation ledger row for reserve diagnostics. */
function pickAllocationTx(ledgerRes, groupId) {
  const items = ledgerRes.data?.items ?? ledgerRes.raw?.items ?? [];
  return items.find(
    (tx) =>
      typeof tx.description === "string" &&
      tx.description.includes("wallet allocation") &&
      (tx.metadata?.groupId === groupId || tx.referenceId),
  );
}

function reserveDiagnostics(groupId, walletData, ledgerTx) {
  const meta = ledgerTx?.metadata ?? {};
  const details = walletData?.reserveDetails?.[0] ?? null;
  return {
    groupId,
    reserveBpsLedger: meta.reserveBps ?? null,
    reservedAtCreationLedger: meta.reserved ?? null,
    availableAtCreationLedger: meta.available ?? null,
    netAtCreationLedger: meta.net ?? null,
    cycleNumberLedger: meta.cycleNumber ?? null,
    walletAvailable: walletData?.availableBalance ?? null,
    walletReserved: walletData?.reservedBalance ?? null,
    walletTotal: walletData?.totalBalance ?? null,
    originalReserve: details?.originalReserveAmount ?? details?.originalAmount ?? null,
    remainingReserve: details?.remainingReserveAmount ?? details?.remainingAmount ?? null,
    releasedReserve: details?.releasedAmount ?? null,
    reserveBpsRecord: details?.reserveBps ?? null,
    payoutCycle: details?.payoutCycle ?? null,
  };
}

async function createSmallGroup(suffix) {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 30);
  const startDate = start.toISOString().slice(0, 10);
  const created = await api("POST", "/groups", {
    token: adminToken,
    body: {
      name: `UAT Small ${suffix}`,
      contributionAmount: 300,
      groupSize: 5,
      payoutMode: "CYCLE",
      daysPerCycle: 10,
      startDate,
      serviceMarginBps: 500,
    },
  });
  if (!created.ok) throw new Error(`Create group: ${JSON.stringify(created.raw).slice(0, 300)}`);
  const group = created.data ?? created.raw;
  return { groupId: group.id, inviteCode: group.inviteCode };
}

async function fillAndActivate(groupId, inviteCode, prefix) {
  const members = [];
  for (let i = 1; i <= 5; i++) {
    const phone = `0248${String(Date.now()).slice(-4)}${String(i).padStart(2, "0")}`;
    members.push(await joinMember(inviteCode, phone, "UAT", `${prefix}${i}`));
    await sleep(100);
  }
  const act = await api("POST", `/groups/${groupId}/activate`, { token: adminToken });
  if (!act.ok) throw new Error(`Activate: ${JSON.stringify(act.raw).slice(0, 200)}`);
  return members;
}

async function payAllContributions(adminTok, groupId, cycle, days = 10) {
  const contribs = await api("GET", `/contributions/group/${groupId}`, { token: adminTok });
  const list = Array.isArray(contribs.data) ? contribs.data : contribs.raw;
  const cycleContribs = list.filter((c) => c.cycleNumber === cycle);
  for (const c of cycleContribs) {
    for (let d = 0; d < days; d++) {
      const r = await mockPayContribution(adminTok, c.id);
      if (!r.ok && r.status !== 400) {
        throw new Error(`Pay ${c.id} day ${d}: ${JSON.stringify(r.raw).slice(0, 150)}`);
      }
      await sleep(30);
    }
  }
  return cycleContribs;
}

async function testSetA() {
  log("\n=== TEST SET A — Small Group Happy Path ===");
  const result = { pass: true, steps: [] };
  try {
    const { groupId, inviteCode } = await createSmallGroup("Happy");
    const members = await fillAndActivate(groupId, inviteCode, "H");
    result.steps.push({ step: "create+activate", groupId, inviteCode, members: 5 });

    const contribs = await payAllContributions(adminToken, groupId, 1, 10);
    result.steps.push({ step: "all paid cycle 1", count: contribs.length });

    const doublePay = await mockPayContribution(adminToken, contribs[0].id);
    result.steps.push({
      step: "double-pay same contribution",
      status: doublePay.status,
      ok: doublePay.ok,
    });
    if (doublePay.ok) {
      bug(
        "A-01",
        "Payments",
        "Critical",
        "Double mock payment on fully paid contribution",
        "Reject or no-op without extra ledger credit",
        "Accepted second payment",
        `status=${doublePay.status}`,
        "Idempotency on paidDayCount / contribution PAID guard",
        true,
        true,
      );
    }

    const fin1 = await api("POST", "/payouts/mock/finalize-cycle", {
      token: adminToken,
      body: { groupId, cycleNumber: 1 },
    });
    result.steps.push({ step: "finalize cycle 1", status: fin1.status, ok: fin1.ok });
    if (!fin1.ok) {
      result.pass = false;
      bug("A-02", "Payout", "High", "Cannot finalize cycle 1", "200 OK", `${fin1.status}`, JSON.stringify(fin1.raw).slice(0, 200), "Investigate payout readiness", true, true);
      return result;
    }

    const recipientId =
      fin1.data?.payout?.recipientId ?? fin1.raw?.payout?.recipientId ?? members[0].userId;
    const recipient = members.find((m) => m.userId === recipientId) ?? members[0];
    result.steps.push({ step: "payout recipient", recipientId, memberIndex: members.indexOf(recipient) });

    const fin1dup = await api("POST", "/payouts/mock/finalize-cycle", {
      token: adminToken,
      body: { groupId, cycleNumber: 1 },
    });
    result.steps.push({ step: "double finalize cycle 1", status: fin1dup.status, ok: fin1dup.ok });
    if (fin1dup.ok) {
      bug("A-03", "Payout", "Critical", "Double finalize same cycle", "409/400 reject", "Succeeded twice", `status=${fin1dup.status}`, "Unique payout per cycle guard", true, true);
    }

    const wallet = await api("GET", "/member/wallet", { token: recipient.token });
    const ledger = await getLedgerTx(groupId);
    const allocTx = pickAllocationTx(ledger, groupId);
    const reserveDiag = reserveDiagnostics(groupId, wallet.data, allocTx);
    result.steps.push({
      step: "recipient wallet",
      available: wallet.data?.availableBalance,
      reserved: wallet.data?.reservedBalance,
      total: wallet.data?.totalBalance,
      reserveDiagnostics: reserveDiag,
    });

    const avail = parseFloat(wallet.data?.availableBalance ?? "0");
    const reserved = parseFloat(wallet.data?.reservedBalance ?? "0");
    const netLedger = parseFloat(reserveDiag.netAtCreationLedger ?? "0");
    const reservedLedger = parseFloat(reserveDiag.reservedAtCreationLedger ?? "0");
    const bpsLedger = reserveDiag.reserveBpsLedger ?? reserveDiag.reserveBpsRecord;
    if (bpsLedger === 2400 && netLedger > 0 && reservedLedger > 0) {
      const expectedReserve = (netLedger * 2400) / 10000;
      if (Math.abs(reservedLedger - expectedReserve) > 0.02) {
        bug(
          "UAT-02",
          "Reserve",
          "High",
          "Ledger reserve at creation does not match 24% for 5-member position 1",
          `~GHS ${(expectedReserve / 100).toFixed(0)} at 2400 bps`,
          `GHS ${reservedLedger}`,
          JSON.stringify(reserveDiag),
          "Verify payoutPosition uses cycleNumber not payment units",
          true,
          true,
        );
      }
    } else if (bpsLedger === 375) {
      bug(
        "UAT-02",
        "Reserve",
        "High",
        "Reserve BPS looks like payment-unit confusion (375 bps ≈ position 35/40)",
        "2400 bps for 5-member cycle 1",
        `${bpsLedger} bps`,
        JSON.stringify(reserveDiag),
        "Use cycleNumber + memberSlots for computeSplit, not payment units",
        true,
        true,
      );
    } else if (
      reserved > 0 &&
      reserveDiag.originalReserve &&
      parseFloat(reserveDiag.originalReserve) > reserved * 1.5
    ) {
      result.steps.push({
        step: "reserve note",
        note:
          "wallet reservedBalance is remaining reserve; see originalReserve in reserveDetails",
        originalReserve: reserveDiag.originalReserve,
        remainingReserve: reserveDiag.remainingReserve,
      });
    } else if (reserved > 0 && reserved < netLedger * 0.15 && bpsLedger !== 2400) {
      bug(
        "UAT-02",
        "Reserve",
        "Medium",
        "Small-group reserve lower than expected for position 1",
        "~24% of net payout (~GHS 2700 on GHS 11250+ net)",
        `GHS ${reserved} reserved (bps=${bpsLedger})`,
        JSON.stringify(reserveDiag),
        "Compare originalReserve vs remainingReserve in reserveDetails",
        false,
        true,
      );
    }
    if (avail <= 0) {
      bug("A-04", "Wallet", "High", "Recipient has no available after payout", ">0 available", wallet.data, JSON.stringify(wallet.data), "Check payout allocation", true, true);
    }
    if (reserved <= 0) {
      bug("A-05", "Reserve", "Medium", "Recipient has no reserve after payout (reserve enabled)", ">0 reserved for early position", wallet.data, JSON.stringify(wallet.data), "Verify reserve BPS for 5-member group", false, true);
    }

    const wdOk = await api("POST", "/member/withdrawals", {
      token: recipient.token,
      body: { amount: avail.toFixed(2), momoNumber: "233241234567" },
    });
    result.steps.push({ step: "withdraw available", status: wdOk.status, ok: wdOk.ok });

    const wdReserved = await api("POST", "/member/withdrawals", {
      token: recipient.token,
      body: { amount: (avail + reserved + 1).toFixed(2), momoNumber: "233241234567" },
    });
    result.steps.push({ step: "withdraw avail+reserved", status: wdReserved.status, ok: wdReserved.ok });
    if (wdReserved.ok) {
      bug("A-06", "Withdrawal", "Critical", "Withdrew more than available (included reserve)", "Reject", "Accepted", `amount=${avail + reserved + 1}`, "Enforce available-only limit", true, true);
    }

    for (const bad of [
      { amount: "abc", label: "invalid abc" },
      { amount: "-100", label: "negative" },
      { amount: "0", label: "zero" },
      { amount: "10,000", label: "comma" },
    ]) {
      const r = await api("POST", "/member/withdrawals", {
        token: recipient.token,
        body: { amount: bad.amount, momoNumber: "233241234567" },
      });
      result.steps.push({ step: `withdraw ${bad.label}`, status: r.status, ok: r.ok });
      if (bad.label === "invalid abc" && r.status === 500) {
        bug(
          "UAT-01",
          "Withdrawal",
          "High",
          'Invalid withdrawal amount "abc" returns 500',
          "400 Bad Request",
          "500 Internal Server Error",
          bad.amount,
          "parseWithdrawalAmount before Prisma.Decimal",
          true,
          true,
        );
      }
      if (r.ok) {
        bug("A-07", "Withdrawal", "High", `Invalid withdrawal amount accepted: ${bad.label}`, "400 reject", "Accepted", bad.amount, "Validation on CreateWithdrawalDto", true, true);
      }
    }

    const rec = await getReconciliation();
    result.steps.push({ step: "reconciliation", status: rec.data?.status, discrepancies: rec.data?.discrepancies?.length ?? 0 });
    if (rec.data?.status === "discrepancies_detected" && (rec.data?.discrepancies?.length ?? 0) > 0) {
      bug("A-08", "Reconciliation", "High", "Critical discrepancy after happy path", "ok", rec.data.discrepancies.join("; "), JSON.stringify(rec.data).slice(0, 300), "Ledger audit", true, true);
    }

    const ledgerSearch = await getLedgerTx(groupId.slice(0, 8));
    result.steps.push({ step: "ledger search", total: ledgerSearch.data?.total ?? ledgerSearch.raw?.total });
  } catch (e) {
    result.pass = false;
    result.error = e instanceof Error ? e.message : String(e);
    bug("A-ERR", "Happy path", "High", "Happy path aborted", "Complete flow", result.error, result.error, "Fix blocking error", true, true);
  }
  return result;
}

async function testRoleIsolation() {
  log("\n=== TEST SET F — Role isolation ===");
  const r = { steps: [] };
  const adminOnHq = await api("GET", "/hq/ledger/accounts?limit=1", { token: adminToken });
  r.steps.push({ adminHqLedger: adminOnHq.status });
  if (adminOnHq.ok) {
    bug("F-01", "Auth", "Critical", "Admin can access HQ ledger", "403", "200", "GET /hq/ledger/accounts", "RolesGuard on HQ routes", true, true);
  }

  const hqOnAdmin = await api("GET", "/auth/admin-check", { token: hqToken });
  r.steps.push({ hqAdminCheck: hqOnAdmin.status });
  if (hqOnAdmin.ok) {
    bug("F-02", "Auth", "High", "HQ can access admin-check", "403", "200", "GET /auth/admin-check", "Role scope", false, true);
  }

  const guestWallet = await api("GET", "/member/wallet");
  r.steps.push({ guestWallet: guestWallet.status });
  if (guestWallet.ok) {
    bug("F-03", "Auth", "Critical", "Unauthenticated wallet access", "401", "200", "GET /member/wallet", "AuthGuard", true, true);
  }

  return r;
}

async function testMemberMockApprove() {
  log("\n=== TEST SET G — Member mock-approve payment path ===");
  const result = { pass: true, steps: [] };
  try {
    const { groupId, inviteCode } = await createSmallGroup("MockApprove");
    const phone = `0245${String(Date.now()).slice(-7)}`;
    const member = await joinMember(inviteCode, phone, "MockPay", "1");
    for (let i = 2; i <= 5; i++) {
      await joinMember(inviteCode, `0245${String(Date.now() + i).slice(-7)}`, "MockPay", String(i));
      await sleep(80);
    }
    await api("POST", `/groups/${groupId}/activate`, { token: adminToken });

    const contribs = await api("GET", `/contributions/group/${groupId}`, {
      token: member.token,
    });
    const list = Array.isArray(contribs.data) ? contribs.data : contribs.raw ?? [];
    const memberContrib = list.find(
      (c) =>
        Number(c.cycleNumber) === 1 &&
        (c.userId === member.userId || c.user?.id === member.userId),
    );
    if (!memberContrib) {
      result.pass = false;
      result.error = "member contribution not found";
      return result;
    }

    const init = await api(
      "POST",
      `/member/payment-requests/contributions/${memberContrib.id}/initiate`,
      { token: member.token },
    );
    result.steps.push({
      step: "initiate payment",
      status: init.status,
      mockApproveHint: init.data?.mockApproveHint ?? init.raw?.mockApproveHint ?? null,
    });
    const hint = init.data?.mockApproveHint ?? init.raw?.mockApproveHint;
    if (!hint) {
      bug(
        "G-01",
        "Payments",
        "High",
        "Staging mock initiate missing mockApproveHint",
        "mockApproveHint in response",
        "missing",
        JSON.stringify(init.raw).slice(0, 200),
        "Ensure PAYMENT_PROVIDER=mock on staging",
        true,
        true,
      );
      result.pass = false;
      return result;
    }

    const reqId = init.data?.id ?? init.raw?.id;
    const approve = await api("POST", `/member/payment-requests/${reqId}/mock-approve`, {
      token: member.token,
    });
    result.steps.push({ step: "mock-approve", status: approve.status, ok: approve.ok });

    const approveDup = await api("POST", `/member/payment-requests/${reqId}/mock-approve`, {
      token: member.token,
    });
    result.steps.push({
      step: "double mock-approve",
      status: approveDup.status,
      ok: approveDup.ok,
    });
    if (approveDup.ok) {
      bug(
        "G-02",
        "Payments",
        "Medium",
        "Double mock-approve succeeded",
        "400 reject on second approve",
        "accepted",
        `status=${approveDup.status}`,
        "Guard APPROVED/PAID status",
        true,
        true,
      );
    }

    const contribsAfter = await api("GET", `/contributions/group/${groupId}`, { token: adminToken });
    const afterList = Array.isArray(contribsAfter.data) ? contribsAfter.data : contribsAfter.raw;
    const updated = afterList.find((c) => c.id === memberContrib.id);
    result.steps.push({
      step: "contribution after pay",
      paidDayCount: updated?.paidDayCount,
      status: updated?.status,
    });
    if (!approve.ok) {
      result.pass = false;
      bug(
        "G-03",
        "Payments",
        "High",
        "Member mock-approve failed",
        "200 OK + PAID progress",
        `${approve.status}`,
        JSON.stringify(approve.raw).slice(0, 200),
        "Check payment-requests mock-approve path",
        true,
        true,
      );
    }
  } catch (e) {
    result.pass = false;
    result.error = e instanceof Error ? e.message : String(e);
  }
  return result;
}

async function testLargeGroup50() {
  log("\n=== TEST SET P2 — Large group (50 members, optional) ===");
  const result = { pass: true, note: "50-member extension mode" };
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 30);
  const created = await api("POST", "/groups", {
    token: adminToken,
    body: {
      name: `UAT Large50 ${Date.now()}`,
      contributionAmount: 50,
      groupSize: 50,
      payoutMode: "CYCLE",
      daysPerCycle: 1,
      startDate: start.toISOString().slice(0, 10),
      serviceMarginBps: 500,
    },
  });
  if (!created.ok) {
    result.pass = false;
    result.error = JSON.stringify(created.raw).slice(0, 200);
    return result;
  }
  const { id: groupId, inviteCode } = created.data ?? created.raw;
  const t0 = Date.now();
  for (let i = 1; i <= 50; i++) {
    await joinMember(inviteCode, `0244${String(Date.now() + i).slice(-7)}`, "L50", String(i));
    if (i % 10 === 0) await sleep(100);
  }
  result.joinMs = Date.now() - t0;
  const act = await api("POST", `/groups/${groupId}/activate`, { token: adminToken });
  if (!act.ok) {
    result.pass = false;
    return result;
  }
  const t1 = Date.now();
  await payAllContributions(adminToken, groupId, 1, 1);
  result.payMs = Date.now() - t1;
  const t2 = Date.now();
  const fin = await api("POST", "/payouts/mock/finalize-cycle", {
    token: adminToken,
    body: { groupId, cycleNumber: 1 },
  });
  result.finalizeMs = Date.now() - t2;
  result.finalizeOk = fin.ok;
  if (fin.ok) {
    const members = await api("GET", `/groups/${groupId}`, { token: adminToken });
    const group = members.data ?? members.raw;
    const firstRecipientId = fin.data?.recipientId ?? fin.raw?.recipientId;
    if (firstRecipientId) {
      const ledger = await getLedgerTx("wallet allocation");
      const allocTx = pickAllocationTx(ledger, groupId);
      result.reserveBps = allocTx?.metadata?.reserveBps ?? null;
      result.expectedReserveBps = "~2985 (30% for position 1 of 50)";
    }
  }
  return result;
}

async function testDuplicateJoin() {
  log("\n=== TEST SET D — Duplicate join / abuse ===");
  const { groupId, inviteCode } = await createSmallGroup("Dup");
  const phone = `0247${String(Date.now()).slice(-7)}`;
  const m1 = await joinMember(inviteCode, phone, "Dup", "1");
  const m2 = await api("POST", "/groups/join", {
    body: {
      inviteCode,
      fullName: "Dup Again",
      phone,
      password: PASS,
    },
  });
  const r = { phone, first: m1.userId, secondStatus: m2.status, secondOk: m2.ok };
  if (m2.ok && m2.data?.access_token) {
    bug("D-01", "Join", "Medium", "Same phone joined group twice", "Reject or same user", "New session created", `status=${m2.status}`, "Dedupe phone in group", false, true);
  }
  return r;
}

async function testLargeGroup() {
  log("\n=== TEST SET D — Large group (20 members, API-limited) ===");
  const result = { pass: true, note: "Used 20 members (staging practical limit for API test)" };
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 30);
  const created = await api("POST", "/groups", {
    token: adminToken,
    body: {
      name: `UAT Large ${Date.now()}`,
      contributionAmount: 50,
      groupSize: 20,
      payoutMode: "CYCLE",
      daysPerCycle: 1,
      startDate: start.toISOString().slice(0, 10),
      serviceMarginBps: 500,
    },
  });
  if (!created.ok) {
    result.pass = false;
    result.error = JSON.stringify(created.raw).slice(0, 200);
    return result;
  }
  const { id: groupId, inviteCode } = created.data ?? created.raw;
  const t0 = Date.now();
  for (let i = 1; i <= 20; i++) {
    const phone = `0246${String(Date.now() + i).slice(-7)}`;
    await joinMember(inviteCode, phone, "Large", String(i));
    if (i % 5 === 0) await sleep(50);
  }
  result.joinMs = Date.now() - t0;
  const act = await api("POST", `/groups/${groupId}/activate`, { token: adminToken });
  result.activateStatus = act.status;
  if (!act.ok) {
    result.pass = false;
    return result;
  }
  const t1 = Date.now();
  await payAllContributions(adminToken, groupId, 1, 1);
  result.payMs = Date.now() - t1;
  const t2 = Date.now();
  const fin = await api("POST", "/payouts/mock/finalize-cycle", {
    token: adminToken,
    body: { groupId, cycleNumber: 1 },
  });
  result.finalizeMs = Date.now() - t2;
  result.finalizeOk = fin.ok;
  const readiness = await api("GET", `/groups/${groupId}/payout-readiness`, { token: adminToken });
  result.payoutReadinessLines = readiness.data?.contributionLine?.length ?? 0;
  if (result.joinMs > 120000) {
    bug("D-02", "Performance", "Medium", "20-member join slow", "<2min", `${result.joinMs}ms`, "join timing", "Optimize join endpoint", false, true);
  }
  return result;
}

async function testGuestEndpoints() {
  log("\n=== TEST SET E — Guest / unauth ===");
  const endpoints = [
    ["/member/me", "GET"],
    ["/member/groups", "GET"],
    ["/admin/overview", "GET"],
  ];
  const r = [];
  for (const [path, method] of endpoints) {
    const res = await api(method, path);
    r.push({ path, status: res.status });
    if (res.ok) bug("E-01", "Auth", "Critical", `Unauth ${method} ${path}`, "401", "200", path, "AuthGuard", true, true);
  }
  return r;
}

async function main() {
  if (!BASE) {
    console.error("Set STAGING_API_URL");
    process.exit(1);
  }
  log(`Staging break-test @ ${BASE}`);
  adminToken = await login("admin@myturn.local");
  hqToken = await login("hq@myturn.local");
  log("Admin + HQ logged in");

  const results = {
    env: { verified: "21/21 assumed" },
    setA: await testSetA(),
    memberMockApprove: await testMemberMockApprove(),
    roles: await testRoleIsolation(),
    duplicateJoin: await testDuplicateJoin(),
    largeGroup: await testLargeGroup(),
    guest: await testGuestEndpoints(),
    findings,
  };
  if (process.env.STAGING_UAT_LARGE === "1") {
    results.largeGroup50 = await testLargeGroup50();
  }

  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify(results, null, 2));
  console.log(`\nFindings: ${findings.length}`);
  for (const f of findings) {
    console.log(`  [${f.severity}] ${f.id} ${f.area}: ${f.what}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
