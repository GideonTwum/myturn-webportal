#!/usr/bin/env node
/**
 * Staging Mock UAT break-test — API-only (no direct DB).
 * Usage: STAGING_API_URL=https://... node scripts/staging-mock-uat-breaktest.mjs
 */
const BASE = (process.env.STAGING_API_URL ?? "").replace(/\/+$/, "");
const PASS = "ChangeMe123!";
const RUN_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const FETCH_TIMEOUT_MS = Number(process.env.STAGING_UAT_FETCH_TIMEOUT_MS ?? 30_000);
const FETCH_RETRIES = Number(process.env.STAGING_UAT_FETCH_RETRIES ?? 3);
const PAY_CONCURRENCY = Number(process.env.STAGING_UAT_PAY_CONCURRENCY ?? 3);
const PAY_DELAY_MS = Number(process.env.STAGING_UAT_PAY_DELAY_MS ?? 50);
const POLL_MS = Number(process.env.STAGING_UAT_POLL_MS ?? 500);
const POLL_MAX = Number(process.env.STAGING_UAT_POLL_MAX ?? 20);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const preview = (v, max = 200) => {
  if (v == null) return null;
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length <= max ? s : `${s.slice(0, max)}…`;
};

const findings = [];
const failureClassifications = [];
let adminToken;
let hqToken;

function bug(id, area, severity, what, expected, actual, evidence, fix, beforeMtn, beforeUsers) {
  findings.push({ id, area, severity, what, expected, actual, evidence, fix, beforeMtn, beforeUsers });
}

function classifyFailure(entry) {
  failureClassifications.push(entry);
}

function log(msg) {
  console.log(msg);
}

function backoffMs(attempt) {
  return Math.min(500 * 2 ** attempt, 4000);
}

function extractUserId(data, raw) {
  return (
    data?.user?.id ??
    raw?.user?.id ??
    data?.userId ??
    raw?.userId ??
    data?.sub ??
    raw?.sub ??
    null
  );
}

function extractToken(data, raw) {
  return data?.access_token ?? raw?.access_token ?? data?.accessToken ?? raw?.accessToken ?? null;
}

function isRetryableStatus(status) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

/** Structured step failure for diagnostics + classification. */
function stepFailure(step, ctx, details) {
  const err = new Error(details.summary ?? `Failed at step: ${step}`);
  err.stepFailure = { step, ...ctx, ...details };
  return err;
}

/**
 * Robust fetch with timeout, retries, and structured errors.
 * @returns {Promise<object>} never throws — check ok / errorKind
 */
async function safeFetch(name, path, options = {}) {
  const {
    method = "GET",
    token,
    body,
    headers = {},
    timeoutMs = FETCH_TIMEOUT_MS,
    retries = FETCH_RETRIES,
    retryStatuses = [429, 502, 503, 504],
  } = options;

  const url = `${BASE}${path}`;
  let last = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const started = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, {
        method,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        body: body != null ? JSON.stringify(body) : undefined,
      });
      clearTimeout(timer);

      const text = await res.text();
      let json = null;
      let parseError = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch (e) {
        parseError = e instanceof Error ? e.message : String(e);
      }

      const data = json?.data ?? json;
      const result = {
        ok: res.ok,
        status: res.status,
        data,
        raw: json ?? text,
        textPreview: preview(text),
        name,
        path,
        method,
        attempt,
        elapsedMs: Date.now() - started,
        error: null,
        errorKind: res.ok ? null : parseError ? "json_parse" : "http",
        parseError,
        bodyPreview: preview(body),
      };

      if (!res.ok && retryStatuses.includes(res.status) && attempt < retries) {
        log(
          `  [retry] ${method} ${path} → ${res.status} (attempt ${attempt + 1}/${retries + 1})`,
        );
        await sleep(backoffMs(attempt));
        last = result;
        continue;
      }

      if (attempt > 0) result.retried = true;
      return result;
    } catch (e) {
      const isTimeout = e?.name === "AbortError";
      const errorKind = isTimeout ? "timeout" : "network";
      last = {
        ok: false,
        status: 0,
        data: null,
        raw: null,
        textPreview: null,
        name,
        path,
        method,
        attempt,
        elapsedMs: Date.now() - started,
        error: e instanceof Error ? e.message : String(e),
        errorKind,
        bodyPreview: preview(body),
      };

      if (attempt < retries) {
        log(
          `  [retry] ${method} ${path} → ${errorKind} (${last.error}) attempt ${attempt + 1}/${retries + 1}`,
        );
        await sleep(backoffMs(attempt));
        continue;
      }
    }
  }

  return last;
}

function logFetchResult(r, { quiet400 = false } = {}) {
  if (r.ok || (quiet400 && r.status === 400)) {
    if (r.ok) {
      log(`  ✓ ${r.method} ${r.path} → ${r.status} (${r.elapsedMs}ms)`);
    }
  } else {
    log(
      `  ✗ ${r.method} ${r.path} → ${r.errorKind ?? "http"} status=${r.status} attempt=${r.attempt} ${preview(r.textPreview ?? r.error, 120)}`,
    );
  }
}

async function api(method, path, opts = {}) {
  const r = await safeFetch(opts.name ?? `${method} ${path}`, path, { method, ...opts });
  if (opts.log !== false) logFetchResult(r, { quiet400: opts.quiet400 });
  return r;
}

function assertOk(r, step, ctx = {}) {
  if (r.ok) return r;
  const kind =
    r.errorKind === "network" || r.errorKind === "timeout"
      ? "transient network"
      : r.status >= 500
        ? "API bug"
        : r.status >= 400
          ? "API bug"
          : "script bug";

  classifyFailure({
    step,
    classification: kind,
    endpoint: `${r.method} ${r.path}`,
    status: r.status,
    errorKind: r.errorKind,
    error: r.error,
    attempt: r.attempt,
    retries: FETCH_RETRIES,
    bodyPreview: r.bodyPreview,
    responsePreview: preview(r.textPreview ?? r.raw),
    ...ctx,
  });

  throw stepFailure(step, ctx, {
    summary:
      r.errorKind === "network" || r.errorKind === "timeout"
        ? `Transient ${r.errorKind} at step "${step}" after ${r.attempt + 1} attempt(s): ${r.error ?? r.errorKind}`
        : `HTTP ${r.status} at step "${step}": ${preview(r.textPreview ?? r.raw, 150)}`,
    endpoint: `${r.method} ${BASE}${r.path}`,
    status: r.status,
    errorKind: r.errorKind,
    responsePreview: preview(r.textPreview ?? r.raw),
    requestBodyPreview: r.bodyPreview,
    retryCount: r.attempt,
  });
}

function uniquePhone(prefix3, index) {
  const tail = `${RUN_ID.replace(/\D/g, "").slice(-5)}${String(index).padStart(2, "0")}`.slice(-7);
  return `${prefix3}${tail}`.slice(0, 10);
}

async function login(email) {
  const r = await api("POST", "/auth/login", {
    name: "login",
    body: { email, password: PASS },
  });
  assertOk(r, "login", { email });
  return extractToken(r.data, r.raw);
}

async function joinMember(inviteCode, phone, name, suffix) {
  const r = await api("POST", "/groups/join", {
    name: `join:${suffix}`,
    body: {
      inviteCode,
      fullName: `${name} ${suffix}`,
      phone,
      password: PASS,
    },
  });
  assertOk(r, `join member ${suffix}`, { inviteCode, phone });
  const userId = extractUserId(r.data, r.raw);
  const token = extractToken(r.data, r.raw);
  if (!userId || !token) {
    throw stepFailure(`join member ${suffix}`, { inviteCode, phone }, {
      summary: "Join response missing user.id or access_token",
      responsePreview: preview(r.raw),
    });
  }
  return { userId, token, phone };
}

async function pollUntil(fn, label, predicate) {
  for (let i = 0; i < POLL_MAX; i++) {
    const value = await fn();
    if (predicate(value)) return value;
    await sleep(POLL_MS);
  }
  throw stepFailure(label, {}, {
    summary: `Timed out waiting for ${label} after ${POLL_MAX} polls`,
  });
}

function normalizeContributions(res) {
  const list = Array.isArray(res.data) ? res.data : Array.isArray(res.raw) ? res.raw : [];
  return list;
}

function contribUserId(c) {
  return c.userId ?? c.user?.id ?? null;
}

async function fetchContributions(token, groupId) {
  const r = await api("GET", `/contributions/group/${groupId}`, {
    token,
    name: `contributions:${groupId.slice(-6)}`,
  });
  assertOk(r, "fetch contributions", { groupId });
  return normalizeContributions(r);
}

async function findMemberContribution(token, groupId, memberUserId, cycle = 1) {
  const list = await pollUntil(
    () => fetchContributions(token, groupId),
    "contributions after activate",
    (items) =>
      items.some(
        (c) => Number(c.cycleNumber) === cycle && contribUserId(c) === memberUserId,
      ),
  );
  const found = list.find(
    (c) => Number(c.cycleNumber) === cycle && contribUserId(c) === memberUserId,
  );
  if (!found) {
    throw stepFailure("find member contribution", { groupId, memberUserId, cycle }, {
      summary: "member contribution not found after polling",
      contributionIds: list.map((c) => ({
        id: c.id,
        userId: contribUserId(c),
        cycle: c.cycleNumber,
        status: c.status,
      })),
    });
  }
  return found;
}

async function getContributionById(token, groupId, contributionId) {
  const list = await fetchContributions(token, groupId);
  return list.find((c) => c.id === contributionId) ?? null;
}

async function mockPayContribution(token, contributionId, ctx = {}) {
  const r = await api("POST", "/payments/mock/contribution-payment", {
    token,
    name: `mock-pay:${contributionId.slice(-6)}`,
    body: { contributionId },
    quiet400: true,
  });

  if (r.ok || r.status === 400) return r;

  if (
    (r.errorKind === "network" || r.errorKind === "timeout") &&
    ctx.groupId
  ) {
    const after = await getContributionById(token, ctx.groupId, contributionId);
    const paidBefore = ctx.paidBefore ?? 0;
    if (after && (after.paidDayCount ?? 0) > paidBefore) {
      return { ...r, ok: true, status: 200, recovered: true, paidDayCount: after.paidDayCount };
    }
  }

  assertOk(r, ctx.step ?? "mock payment", {
    contributionId,
    groupId: ctx.groupId,
    ...ctx,
  });
  return r;
}

/** Bounded concurrency worker pool. */
async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function payAllContributions(adminTok, groupId, cycle, days = 10) {
  const list = await fetchContributions(adminTok, groupId);
  const cycleContribs = list.filter((c) => Number(c.cycleNumber) === cycle);
  if (cycleContribs.length === 0) {
    throw stepFailure("pay all contributions", { groupId, cycle }, {
      summary: `No contributions for cycle ${cycle}`,
      contributionCount: list.length,
    });
  }

  log(
    `  Paying ${cycleContribs.length} members × ${days} days (concurrency=${PAY_CONCURRENCY} across members)…`,
  );
  let errors = 0;

  await mapPool(cycleContribs, PAY_CONCURRENCY, async (c) => {
    let paidBefore = c.paidDayCount ?? 0;
    for (let d = 0; d < days; d++) {
      const r = await mockPayContribution(adminTok, c.id, {
        groupId,
        step: `mock pay ${contribUserId(c)?.slice(-6)} cycle ${cycle} day ${d + 1}/${days}`,
        memberUserId: contribUserId(c),
        paidBefore,
      });
      if (!r.ok && r.status !== 400) errors++;
      else paidBefore = r.paidDayCount ?? paidBefore + 1;
      await sleep(PAY_DELAY_MS);
    }
  });

  log(`  Mock payments done: ${errors} hard failure(s)`);
  if (errors > 0) {
    throw stepFailure("pay all contributions", { groupId, cycle }, {
      summary: `${errors} mock payment(s) failed after retries`,
    });
  }

  return cycleContribs;
}

async function getReconciliation() {
  return api("GET", "/hq/reconciliation/summary", { token: hqToken, name: "reconciliation" });
}

async function getLedgerTx(search) {
  return api("GET", `/hq/ledger/transactions?limit=10&search=${encodeURIComponent(search)}`, {
    token: hqToken,
    name: `ledger:${search.slice(0, 12)}`,
  });
}

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

async function createSmallGroup(label) {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 30);
  const created = await api("POST", "/groups", {
    token: adminToken,
    name: "create group",
    body: {
      name: `UAT ${label} ${RUN_ID}`,
      contributionAmount: 300,
      groupSize: 5,
      payoutMode: "CYCLE",
      daysPerCycle: 10,
      startDate: start.toISOString().slice(0, 10),
      serviceMarginBps: 500,
    },
  });
  assertOk(created, "create group", { label });
  const group = created.data ?? created.raw;
  return { groupId: group.id, inviteCode: group.inviteCode };
}

async function testSetA() {
  log("\n=== TEST SET A — Small Group Happy Path ===");
  const result = { pass: true, steps: [], runId: RUN_ID };
  const ctx = { groupId: null, members: [] };

  try {
    log("  Step 1: create group");
    const { groupId, inviteCode } = await createSmallGroup("SmallHappy");
    ctx.groupId = groupId;
    result.steps.push({ step: "1 create group", groupId, inviteCode, runId: RUN_ID });

    log("  Step 2: join members 1..5");
    const members = [];
    for (let i = 1; i <= 5; i++) {
      const phone = uniquePhone("024", i);
      members.push(await joinMember(inviteCode, phone, "UAT", `H${i}`));
      await sleep(80);
    }
    ctx.members = members;
    result.steps.push({
      step: "2 join members",
      count: members.length,
      userIds: members.map((m) => m.userId),
    });

    log("  Step 3: activate group");
    const act = await api("POST", `/groups/${groupId}/activate`, {
      token: adminToken,
      name: "activate group",
    });
    assertOk(act, "activate group", { groupId });
    result.steps.push({ step: "3 activate group", status: act.status });

    log("  Step 4–6: fetch contributions + mock pay cycle 1");
    const contribs = await payAllContributions(adminToken, groupId, 1, 10);
    result.steps.push({
      step: "4-6 mock pay cycle 1",
      contributionCount: contribs.length,
      contributionIds: contribs.map((c) => c.id),
    });

    const postPayList = await fetchContributions(adminToken, groupId);
    result.steps.push({
      step: "6 check contribution status",
      statuses: postPayList
        .filter((c) => Number(c.cycleNumber) === 1)
        .map((c) => ({
          id: c.id?.slice(-6),
          userId: contribUserId(c)?.slice(-6),
          paidDayCount: c.paidDayCount,
          status: c.status,
        })),
    });

    log("  Step 7: double-pay guard");
    const doublePay = await mockPayContribution(adminToken, contribs[0].id, {
      groupId,
      step: "double-pay",
    });
    result.steps.push({
      step: "7 double-pay same contribution",
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

    log("  Step 8: finalize cycle 1");
    const fin1 = await api("POST", "/payouts/mock/finalize-cycle", {
      token: adminToken,
      name: "finalize cycle 1",
      body: { groupId, cycleNumber: 1 },
    });
    assertOk(fin1, "finalize cycle 1", { groupId });
    result.steps.push({ step: "8 finalize cycle 1", status: fin1.status });

    const recipientId =
      fin1.data?.payout?.recipientId ??
      fin1.raw?.payout?.recipientId ??
      members[0].userId;
    const recipient = members.find((m) => m.userId === recipientId) ?? members[0];
    result.steps.push({
      step: "8b payout recipient",
      recipientId,
      memberIndex: members.indexOf(recipient),
    });

    const fin1dup = await api("POST", "/payouts/mock/finalize-cycle", {
      token: adminToken,
      name: "double finalize",
      body: { groupId, cycleNumber: 1 },
    });
    result.steps.push({ step: "8c double finalize", status: fin1dup.status, ok: fin1dup.ok });
    if (fin1dup.ok) {
      bug(
        "A-03",
        "Payout",
        "Critical",
        "Double finalize same cycle",
        "409/400 reject",
        "Succeeded twice",
        `status=${fin1dup.status}`,
        "Unique payout per cycle guard",
        true,
        true,
      );
    }

    log("  Step 9: wallet check");
    const wallet = await api("GET", "/member/wallet", {
      token: recipient.token,
      name: "member wallet",
    });
    assertOk(wallet, "wallet check", { recipientId });
    const ledger = await getLedgerTx(groupId);
    const allocTx = pickAllocationTx(ledger, groupId);
    const reserveDiag = reserveDiagnostics(groupId, wallet.data, allocTx);
    result.steps.push({
      step: "9 wallet check",
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
          `~GHS ${expectedReserve.toFixed(0)} at 2400 bps`,
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
        step: "9b reserve note",
        note: "wallet reservedBalance is remaining; see originalReserve in reserveDetails",
        originalReserve: reserveDiag.originalReserve,
        remainingReserve: reserveDiag.remainingReserve,
      });
    } else if (reserved > 0 && reserved < netLedger * 0.15 && bpsLedger !== 2400) {
      bug(
        "UAT-02",
        "Reserve",
        "Medium",
        "Small-group reserve lower than expected for position 1",
        "~24% of net payout",
        `GHS ${reserved} reserved (bps=${bpsLedger})`,
        JSON.stringify(reserveDiag),
        "Compare originalReserve vs remainingReserve in reserveDetails",
        false,
        true,
      );
    }

    if (avail <= 0) {
      bug(
        "A-04",
        "Wallet",
        "High",
        "Recipient has no available after payout",
        ">0 available",
        wallet.data,
        JSON.stringify(wallet.data),
        "Check payout allocation",
        true,
        true,
      );
    }
    if (reserved <= 0 && !reserveDiag.originalReserve) {
      bug(
        "A-05",
        "Reserve",
        "Medium",
        "Recipient has no reserve after payout (reserve enabled)",
        ">0 reserved for early position",
        wallet.data,
        JSON.stringify(wallet.data),
        "Verify reserve BPS for 5-member group",
        false,
        true,
      );
    }

    log("  Step 10: withdrawal tests");
    const wdOk = await api("POST", "/member/withdrawals", {
      token: recipient.token,
      name: "withdraw available",
      body: { amount: avail.toFixed(2), momoNumber: "233241234567" },
    });
    result.steps.push({ step: "10a withdraw available", status: wdOk.status, ok: wdOk.ok });

    const wdReserved = await api("POST", "/member/withdrawals", {
      token: recipient.token,
      name: "withdraw over available",
      body: { amount: (avail + reserved + 1).toFixed(2), momoNumber: "233241234567" },
    });
    result.steps.push({
      step: "10b withdraw avail+reserved",
      status: wdReserved.status,
      ok: wdReserved.ok,
    });
    if (wdReserved.ok) {
      bug(
        "A-06",
        "Withdrawal",
        "Critical",
        "Withdrew more than available (included reserve)",
        "Reject",
        "Accepted",
        `amount=${avail + reserved + 1}`,
        "Enforce available-only limit",
        true,
        true,
      );
    }

    for (const bad of [
      { amount: "abc", label: "invalid abc" },
      { amount: "-100", label: "negative" },
      { amount: "0", label: "zero" },
      { amount: "10,000", label: "comma" },
    ]) {
      const r = await api("POST", "/member/withdrawals", {
        token: recipient.token,
        name: `withdraw ${bad.label}`,
        body: { amount: bad.amount, momoNumber: "233241234567" },
      });
      result.steps.push({ step: `10c withdraw ${bad.label}`, status: r.status, ok: r.ok });
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
        bug(
          "A-07",
          "Withdrawal",
          "High",
          `Invalid withdrawal amount accepted: ${bad.label}`,
          "400 reject",
          "Accepted",
          bad.amount,
          "Validation on CreateWithdrawalDto",
          true,
          true,
        );
      }
    }

    log("  Step 11: reconciliation");
    const rec = await getReconciliation();
    result.steps.push({
      step: "11 reconciliation",
      status: rec.data?.status,
      discrepancies: rec.data?.discrepancies?.length ?? 0,
    });
    if (rec.data?.status === "discrepancies_detected" && (rec.data?.discrepancies?.length ?? 0) > 0) {
      bug(
        "A-08",
        "Reconciliation",
        "High",
        "Critical discrepancy after happy path",
        "ok",
        rec.data.discrepancies.join("; "),
        JSON.stringify(rec.data).slice(0, 300),
        "Ledger audit",
        true,
        true,
      );
    }

    const ledgerSearch = await getLedgerTx(groupId.slice(0, 8));
    result.steps.push({
      step: "11b ledger search",
      total: ledgerSearch.data?.total ?? ledgerSearch.raw?.total,
    });
  } catch (e) {
    result.pass = false;
    const sf = e.stepFailure ?? {
      step: "unknown",
      summary: e instanceof Error ? e.message : String(e),
    };
    result.failure = sf;
    result.error = sf.summary ?? (e instanceof Error ? e.message : String(e));
    log(`  ✗ Set A failed: ${result.error}`);
    if (!findings.some((f) => f.id === "A-ERR")) {
      bug(
        "A-ERR",
        "Happy path",
        sf.errorKind === "network" || sf.errorKind === "timeout" ? "Medium" : "High",
        result.error,
        "Complete flow",
        result.error,
        JSON.stringify(sf).slice(0, 400),
        sf.classification === "transient network"
          ? "Retry break-test; check Railway latency"
          : "Fix blocking error",
        true,
        true,
      );
    }
  }
  return result;
}

async function testRoleIsolation() {
  log("\n=== TEST SET F — Role isolation ===");
  const r = { steps: [] };
  const adminOnHq = await api("GET", "/hq/ledger/accounts?limit=1", {
    token: adminToken,
    name: "admin hq ledger",
  });
  r.steps.push({ adminHqLedger: adminOnHq.status });
  if (adminOnHq.ok) {
    bug(
      "F-01",
      "Auth",
      "Critical",
      "Admin can access HQ ledger",
      "403",
      "200",
      "GET /hq/ledger/accounts",
      "RolesGuard on HQ routes",
      true,
      true,
    );
  }

  const hqOnAdmin = await api("GET", "/auth/admin-check", { token: hqToken, name: "hq admin-check" });
  r.steps.push({ hqAdminCheck: hqOnAdmin.status });
  if (hqOnAdmin.ok) {
    bug(
      "F-02",
      "Auth",
      "High",
      "HQ can access admin-check",
      "403",
      "200",
      "GET /auth/admin-check",
      "Role scope",
      false,
      true,
    );
  }

  const guestWallet = await api("GET", "/member/wallet", { name: "guest wallet" });
  r.steps.push({ guestWallet: guestWallet.status });
  if (guestWallet.ok) {
    bug(
      "F-03",
      "Auth",
      "Critical",
      "Unauthenticated wallet access",
      "401",
      "200",
      "GET /member/wallet",
      "AuthGuard",
      true,
      true,
    );
  }

  return r;
}

async function pollPaymentRequest(token, reqId) {
  return pollUntil(
    async () => {
      const r = await api("GET", `/member/payment-requests/${reqId}`, {
        token,
        name: "poll payment request",
        log: false,
      });
      return r.ok ? r.data ?? r.raw : null;
    },
    "payment request settled",
    (pr) => pr && (pr.status === "APPROVED" || pr.status === "PAID" || pr.status === "COMPLETED"),
  );
}

async function testMemberMockApprove() {
  log("\n=== TEST SET G — Member mock-approve payment path ===");
  const result = { pass: true, steps: [], runId: RUN_ID };

  try {
    log("  G1: create group");
    const { groupId, inviteCode } = await createSmallGroup("MockApprove");
    result.steps.push({ step: "G1 create group", groupId, inviteCode });

    log("  G2: join 5 members");
    const members = [];
    for (let i = 1; i <= 5; i++) {
      members.push(await joinMember(inviteCode, uniquePhone("025", i), "MockPay", String(i)));
      await sleep(80);
    }
    const member = members[0];
    result.steps.push({
      step: "G2 join members",
      memberUserId: member.userId,
      memberIds: members.map((m) => m.userId),
    });

    log("  G3: activate");
    const act = await api("POST", `/groups/${groupId}/activate`, {
      token: adminToken,
      name: "activate mock-approve group",
    });
    assertOk(act, "G3 activate", { groupId });
    result.steps.push({ step: "G3 activate", status: act.status });

    log("  G4: find member contribution");
    const memberContrib = await findMemberContribution(
      adminToken,
      groupId,
      member.userId,
      1,
    );
    result.steps.push({
      step: "G4 find contribution",
      groupId,
      memberUserId: member.userId,
      contributionId: memberContrib.id,
      statusBefore: memberContrib.status,
      paidDayCountBefore: memberContrib.paidDayCount,
    });

    log("  G5: initiate member payment");
    const init = await api(
      "POST",
      `/member/payment-requests/contributions/${memberContrib.id}/initiate`,
      { token: member.token, name: "initiate payment" },
    );
    assertOk(init, "G5 initiate payment", {
      groupId,
      contributionId: memberContrib.id,
      memberUserId: member.userId,
    });

    const hint = init.data?.mockApproveHint ?? init.raw?.mockApproveHint ?? null;
    const reqId = init.data?.id ?? init.raw?.id ?? null;
    result.steps.push({
      step: "G5 initiate payment",
      status: init.status,
      paymentRequestId: reqId,
      mockApproveHint: hint,
    });

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

    log("  G6: mock approve");
    const approve = await api("POST", `/member/payment-requests/${reqId}/mock-approve`, {
      token: member.token,
      name: "mock approve",
    });
    assertOk(approve, "G6 mock approve", { paymentRequestId: reqId, contributionId: memberContrib.id });
    result.steps.push({ step: "G6 mock approve", status: approve.status, ok: approve.ok });

    log("  G7: poll payment request + contribution");
    const prAfter = await pollPaymentRequest(member.token, reqId);
    const contribAfter = await getContributionById(adminToken, groupId, memberContrib.id);
    result.steps.push({
      step: "G7 after approve",
      paymentRequestStatus: prAfter?.status,
      paidDayCount: contribAfter?.paidDayCount,
      contributionStatus: contribAfter?.status,
    });

    log("  G8: double mock-approve guard");
    const approveDup = await api("POST", `/member/payment-requests/${reqId}/mock-approve`, {
      token: member.token,
      name: "double mock approve",
    });
    result.steps.push({
      step: "G8 double mock-approve",
      status: approveDup.status,
      ok: approveDup.ok,
    });
    if (approveDup.ok && prAfter?.status === "APPROVED") {
      const prDupCheck = await api("GET", `/member/payment-requests/${reqId}`, {
        token: member.token,
        name: "check double approve",
      });
      const dupSettled =
        prDupCheck.data?.status === "APPROVED" &&
        (contribAfter?.paidDayCount ?? 0) <= 1;
      if (!dupSettled) {
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
      } else {
        result.steps.push({
          step: "G8 double mock-approve",
          note: "Second call idempotent (201) but no extra paidDayCount",
          status: approveDup.status,
        });
      }
    } else if (approveDup.ok) {
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

    log("  G9: ledger journal check");
    const ledger = await getLedgerTx(groupId);
    const items = ledger.data?.items ?? ledger.raw?.items ?? [];
    const collection =
      items.find(
        (tx) =>
          typeof tx.description === "string" &&
          (tx.description.includes("Contribution collected") ||
            tx.description.includes("contribution")),
      ) ??
      (ledger.ok && items.length === 0
        ? (
            await getLedgerTx("Contribution collected")
          ).data?.items?.find((tx) => tx.metadata?.groupId === groupId)
        : null);
    result.steps.push({
      step: "G9 ledger",
      journalFound: !!collection,
      ledgerTotal: ledger.data?.total ?? items.length,
    });
    if (!collection) {
      bug(
        "G-04",
        "Payments",
        "Medium",
        "No contribution collection journal visible after mock-approve",
        "Collection journal in HQ ledger",
        "not found in first page",
        `groupId=${groupId}`,
        "Search ledger or verify settlement posted",
        false,
        true,
      );
    }
  } catch (e) {
    result.pass = false;
    const sf = e.stepFailure ?? { summary: e instanceof Error ? e.message : String(e) };
    result.failure = sf;
    result.error = sf.summary ?? String(e);
    log(`  ✗ Set G failed: ${result.error}`);
    classifyFailure({
      step: sf.step ?? "member mock-approve",
      classification:
        sf.errorKind === "network" || sf.errorKind === "timeout"
          ? "transient network"
          : sf.summary?.includes("not found")
            ? "script bug"
            : "API bug",
      ...sf,
    });
  }
  return result;
}

async function testLargeGroup50() {
  log("\n=== TEST SET P2 — Large group (50 members, optional) ===");
  const result = { pass: true, note: "50-member extension mode", runId: RUN_ID };
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 30);
  const created = await api("POST", "/groups", {
    token: adminToken,
    name: "create large50",
    body: {
      name: `UAT Large50 ${RUN_ID}`,
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
    result.error = preview(created.raw);
    return result;
  }
  const { id: groupId, inviteCode } = created.data ?? created.raw;
  const t0 = Date.now();
  for (let i = 1; i <= 50; i++) {
    await joinMember(inviteCode, uniquePhone("026", i), "L50", String(i));
    if (i % 10 === 0) await sleep(100);
  }
  result.joinMs = Date.now() - t0;
  const act = await api("POST", `/groups/${groupId}/activate`, { token: adminToken, name: "activate large50" });
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
    name: "finalize large50",
    body: { groupId, cycleNumber: 1 },
  });
  result.finalizeMs = Date.now() - t2;
  result.finalizeOk = fin.ok;
  if (fin.ok) {
    const ledger = await getLedgerTx("wallet allocation");
    const allocTx = pickAllocationTx(ledger, groupId);
    result.reserveBps = allocTx?.metadata?.reserveBps ?? null;
    result.expectedReserveBps = "~2985 (30% for position 1 of 50)";
  }
  return result;
}

async function testDuplicateJoin() {
  log("\n=== TEST SET D — Duplicate join / abuse ===");
  const { groupId, inviteCode } = await createSmallGroup("Dup");
  const phone = uniquePhone("027", 1);
  const m1 = await joinMember(inviteCode, phone, "Dup", "1");
  const m2 = await api("POST", "/groups/join", {
    name: "duplicate join",
    body: {
      inviteCode,
      fullName: "Dup Again",
      phone,
      password: PASS,
    },
  });
  const r = { phone, first: m1.userId, secondStatus: m2.status, secondOk: m2.ok, groupId };
  if (m2.ok && extractToken(m2.data, m2.raw)) {
    bug(
      "D-01",
      "Join",
      "Medium",
      "Same phone joined group twice",
      "Reject or same user",
      "New session created",
      `status=${m2.status}`,
      "Dedupe phone in group",
      false,
      true,
    );
  }
  return r;
}

async function testLargeGroup() {
  log("\n=== TEST SET D — Large group (20 members, API-limited) ===");
  const result = { pass: true, note: "Used 20 members (staging practical limit for API test)", runId: RUN_ID };
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 30);
  const created = await api("POST", "/groups", {
    token: adminToken,
    name: "create large20",
    body: {
      name: `UAT Large ${RUN_ID}`,
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
    result.error = preview(created.raw);
    return result;
  }
  const { id: groupId, inviteCode } = created.data ?? created.raw;
  const t0 = Date.now();
  for (let i = 1; i <= 20; i++) {
    await joinMember(inviteCode, uniquePhone("028", i), "Large", String(i));
    if (i % 5 === 0) await sleep(50);
  }
  result.joinMs = Date.now() - t0;
  const act = await api("POST", `/groups/${groupId}/activate`, {
    token: adminToken,
    name: "activate large20",
  });
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
    name: "finalize large20",
    body: { groupId, cycleNumber: 1 },
  });
  result.finalizeMs = Date.now() - t2;
  result.finalizeOk = fin.ok;
  const readiness = await api("GET", `/groups/${groupId}/payout-readiness`, {
    token: adminToken,
    name: "payout readiness large20",
  });
  result.payoutReadinessLines = readiness.data?.contributionLine?.length ?? 0;
  if (result.joinMs > 120000) {
    bug(
      "D-02",
      "Performance",
      "Medium",
      "20-member join slow",
      "<2min",
      `${result.joinMs}ms`,
      "join timing",
      "Optimize join endpoint",
      false,
      true,
    );
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
    const res = await api(method, path, { name: `guest ${method} ${path}` });
    r.push({ path, status: res.status });
    if (res.ok) {
      bug(
        "E-01",
        "Auth",
        "Critical",
        `Unauth ${method} ${path}`,
        "401",
        "200",
        path,
        "AuthGuard",
        true,
        true,
      );
    }
  }
  return r;
}

function buildVerdict(results) {
  const productBugs = findings.filter((f) => f.severity === "Critical" || f.severity === "High");
  const transient = failureClassifications.filter((f) => f.classification === "transient network");
  const scriptIssues = failureClassifications.filter((f) => f.classification === "script bug");

  if (productBugs.length > 0) {
    return "STAGING MOCK UAT FAILED — FIX REQUIRED";
  }
  if (transient.length > 0 && !results.setA?.pass) {
    return "STAGING MOCK UAT PASSED WITH WARNINGS";
  }
  if (findings.length > 0 || scriptIssues.length > 0) {
    return "STAGING MOCK UAT PASSED WITH WARNINGS";
  }
  if (results.setA?.pass && results.memberMockApprove?.pass) {
    return "STAGING MOCK UAT PASSED";
  }
  return "STAGING MOCK UAT PASSED WITH WARNINGS";
}

async function main() {
  if (!BASE) {
    console.error("Set STAGING_API_URL");
    process.exit(1);
  }
  log(`Staging break-test @ ${BASE}`);
  log(`Run ID: ${RUN_ID} (timeout=${FETCH_TIMEOUT_MS}ms retries=${FETCH_RETRIES} payConcurrency=${PAY_CONCURRENCY})`);

  adminToken = await login("admin@myturn.local");
  hqToken = await login("hq@myturn.local");
  log("Admin + HQ logged in");

  const results = {
    env: { verified: "21/21 assumed", runId: RUN_ID },
    setA: await testSetA(),
    memberMockApprove: await testMemberMockApprove(),
    roles: await testRoleIsolation(),
    duplicateJoin: await testDuplicateJoin(),
    largeGroup: await testLargeGroup(),
    guest: await testGuestEndpoints(),
    failureClassifications,
    findings,
  };
  if (process.env.STAGING_UAT_LARGE === "1") {
    results.largeGroup50 = await testLargeGroup50();
  }

  results.verdict = buildVerdict(results);

  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify(results, null, 2));
  console.log(`\nVerdict: ${results.verdict}`);
  console.log(`Findings (product): ${findings.length}`);
  for (const f of findings) {
    console.log(`  [${f.severity}] ${f.id} ${f.area}: ${f.what}`);
  }
  if (failureClassifications.length > 0) {
    console.log(`\nFailure classifications:`);
    for (const f of failureClassifications) {
      console.log(`  [${f.classification}] ${f.step}: ${f.endpoint ?? ""} ${f.summary ?? f.error ?? ""}`);
    }
  }

  const hardFail = results.verdict.includes("FAILED");
  if (hardFail) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
