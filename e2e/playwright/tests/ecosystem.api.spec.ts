import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@myturn.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "ChangeMe123!";
const HQ_EMAIL = process.env.E2E_HQ_EMAIL ?? "hq@myturn.local";
const HQ_PASSWORD = process.env.E2E_HQ_PASSWORD ?? "ChangeMe123!";
const MEMBER_PHONE = process.env.E2E_MEMBER_PHONE ?? "0240000001";
const PAY_PHONE = process.env.E2E_PAY_PHONE ?? "0240000001";
const DEMO_INVITE = process.env.E2E_INVITE_CODE ?? "STAGING-DEMO";

async function unwrapJson(res: import("@playwright/test").APIResponse) {
  const body = await res.json();
  if (body && typeof body === "object" && "success" in body && "data" in body) {
    return body.data;
  }
  return body;
}

test.describe("Flow 1 — Admin ecosystem", () => {
  test("admin login, groups, create + activate group", async ({ request, baseURL }) => {
    const health = await unwrapJson(await request.get(`${baseURL}/health`));
    expect(["ok", "degraded"]).toContain(health.status);
    expect(health.infrastructure?.sms).toBeTruthy();

    const login = await unwrapJson(
      await request.post(`${baseURL}/auth/login`, {
        data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
      }),
    );
    const adminToken = login.access_token ?? login.accessToken;
    expect(adminToken).toBeTruthy();

    const groups = await unwrapJson(
      await request.get(`${baseURL}/groups/mine`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      }),
    );
    expect(Array.isArray(groups)).toBe(true);

    const suffix = Date.now().toString(36);
    const created = await unwrapJson(
      await request.post(`${baseURL}/groups`, {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: {
          name: `E2E Circle ${suffix}`,
          contributionAmount: 50,
          groupSize: 5,
          payoutMode: "CYCLE",
          daysPerCycle: 7,
          startDate: new Date().toISOString().slice(0, 10),
          serviceMarginBps: 500,
        },
      }),
    );
    expect(created.id).toBeTruthy();
    expect(created.inviteCode).toBeTruthy();

    const activated = await unwrapJson(
      await request.post(`${baseURL}/groups/${created.id}/activate`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      }),
    );
    expect(activated.status).toBe("ACTIVE");
  });
});

test.describe("Flow 2 — Member OTP + payment intent", () => {
  test("OTP, join, contribution payment intent", async ({ request, baseURL }) => {
    const otpReq = await unwrapJson(
      await request.post(`${baseURL}/auth/otp/request`, {
        data: { phone: MEMBER_PHONE },
      }),
    );
    const code = otpReq.debugCode;
    expect(code).toBeTruthy();

    const session = await unwrapJson(
      await request.post(`${baseURL}/auth/otp/verify`, {
        data: { phone: MEMBER_PHONE, code },
      }),
    );
    const token = session.access_token ?? session.accessToken;
    expect(token).toBeTruthy();

    const joinRes = await request.post(`${baseURL}/groups/join`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        inviteCode: DEMO_INVITE,
        fullName: "Playwright E2E",
        phone: MEMBER_PHONE,
        password: "E2ePlaywright123!",
      },
    });
    expect([200, 201, 400]).toContain(joinRes.status());

    const payOtp = await unwrapJson(
      await request.post(`${baseURL}/auth/otp/request`, {
        data: { phone: PAY_PHONE },
      }),
    );
    const payCode = payOtp.debugCode;
    expect(payCode).toBeTruthy();
    const paySession = await unwrapJson(
      await request.post(`${baseURL}/auth/otp/verify`, {
        data: { phone: PAY_PHONE, code: payCode },
      }),
    );
    const payToken = paySession.access_token ?? paySession.accessToken;

    const groups = await unwrapJson(
      await request.get(`${baseURL}/member/groups`, {
        headers: { Authorization: `Bearer ${payToken}` },
      }),
    );
    const memberships = groups.memberships ?? groups;
    const payable = memberships.find(
      (m: { contributionId?: string; contributionStatus?: string; groupStatus?: string }) =>
        m.contributionId &&
        m.contributionStatus === "PENDING" &&
        m.groupStatus === "ACTIVE",
    );
    expect(payable).toBeTruthy();

    const initiated = await unwrapJson(
      await request.post(
        `${baseURL}/member/payment-requests/contributions/${payable.contributionId}/initiate`,
        { headers: { Authorization: `Bearer ${payToken}` } },
      ),
    );
    expect(initiated.id).toBeTruthy();

    const approved = await unwrapJson(
      await request.post(
        `${baseURL}/member/payment-requests/${initiated.id}/mock-approve`,
        { headers: { Authorization: `Bearer ${payToken}` } },
      ),
    );
    expect(approved.status).toBe("APPROVED");
  });
});

test.describe("Flow 3 — HQ visibility", () => {
  test("HQ login sees transactions and admin requests", async ({ request, baseURL }) => {
    const login = await unwrapJson(
      await request.post(`${baseURL}/auth/login`, {
        data: { email: HQ_EMAIL, password: HQ_PASSWORD },
      }),
    );
    const token = login.access_token ?? login.accessToken;
    expect(token).toBeTruthy();

    const overview = await unwrapJson(
      await request.get(`${baseURL}/hq/overview`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    expect(overview).toBeTruthy();

    const txs = await unwrapJson(
      await request.get(`${baseURL}/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    expect(Array.isArray(txs)).toBe(true);

    const requests = await unwrapJson(
      await request.get(`${baseURL}/admin-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    expect(Array.isArray(requests)).toBe(true);
  });
});
