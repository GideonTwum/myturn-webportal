/**
 * Joins test users via POST /api/groups/join (no direct DB writes).
 * Usage: node scripts/join-test-members.mjs
 * Requires: API running (e.g. npm run dev:api), DATABASE with group MT-8B76.
 */

const API = process.env.API_URL?.trim();
if (!API) {
  console.error(
    "Set API_URL to your API base, e.g. https://api.example.com/api",
  );
  process.exit(1);
}
const INVITE = "MT-8B76";
const PASSWORD = process.env.JOIN_TEST_PASSWORD ?? "TestJoin123!";

const MEMBERS = [
  { fullName: "John Doe", phone: "0240000001", email: "john.test@myturn.local" },
  { fullName: "Mary Smith", phone: "0240000002", email: "mary.test@myturn.local" },
  { fullName: "Alex Mensah", phone: "0240000003", email: "alex.test@myturn.local" },
  { fullName: "Grace Owusu", phone: "0240000004", email: "grace.test@myturn.local" },
  {
    fullName: "Daniel Boateng",
    phone: "0240000005",
    email: "daniel.test@myturn.local",
  },
];

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@myturn.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";

async function api(method, path, { body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json };
}

async function main() {
  console.log(`API: ${API}\nInvite: ${INVITE}\n`);

  const pre = await api("GET", `/groups/invite/${encodeURIComponent(INVITE)}`);
  if (!pre.ok) {
    console.error("Preflight GET invite failed:", pre.status, pre.json);
    process.exit(1);
  }
  console.log("Preflight invite preview:", JSON.stringify(pre.json, null, 2));
  const groupSize = pre.json.groupSize;
  const before = pre.json.currentMembers;

  for (const m of MEMBERS) {
    const r = await api("POST", "/groups/join", {
      body: {
        inviteCode: INVITE,
        fullName: m.fullName,
        phone: m.phone,
        email: m.email,
        password: PASSWORD,
      },
    });
    if (r.ok) {
      console.log(`OK  ${m.fullName} (${m.email}):`, r.json?.message ?? r.json);
    } else {
      console.error(
        `FAIL ${m.fullName} (${m.email}):`,
        r.status,
        r.json?.message ?? r.json,
      );
    }
  }

  const afterInvite = await api(
    "GET",
    `/groups/invite/${encodeURIComponent(INVITE)}`,
  );
  console.log("\nInvite preview after joins (may be 400 if full):", afterInvite.status, afterInvite.json);

  const login = await api("POST", "/auth/login", {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!login.ok) {
    console.error("Admin login failed:", login.status, login.json);
    process.exit(1);
  }
  const token = login.json.access_token;
  if (!token) {
    console.error("No access_token in login response:", login.json);
    process.exit(1);
  }

  const mine = await api("GET", "/groups/mine", { token });
  if (!mine.ok) {
    console.error("GET /groups/mine failed:", mine.status, mine.json);
    process.exit(1);
  }
  const group = mine.json.find((g) => g.inviteCode === INVITE);
  if (!group) {
    console.error(
      "Group with invite not found in admin list. Groups:",
      mine.json.map((g) => ({ id: g.id, inviteCode: g.inviteCode, name: g.name })),
    );
    process.exit(1);
  }

  const detail = await api("GET", `/groups/${group.id}`, { token });
  if (!detail.ok) {
    console.error("GET group detail failed:", detail.status, detail.json);
    process.exit(1);
  }

  const members = (detail.json.members ?? []).filter(
    (x) => x.status === "ACTIVE",
  );
  members.sort((a, b) => a.turnOrder - b.turnOrder);

  console.log("\n--- Verification (admin) ---");
  console.log(`Group: ${detail.json.name} status=${detail.json.status} slots=${detail.json.memberSlots}`);
  console.log(`Active members: ${members.length}`);
  for (const mem of members) {
    const u = mem.user;
    const label =
      [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
    console.log(`  turn ${mem.turnOrder}: ${label} <${u.email}>`);
  }

  const canActivate =
    detail.json.status === "DRAFT" && members.length === detail.json.memberSlots;
  console.log(
    `\nActivate-ready (draft + members === groupSize): ${canActivate}`,
  );

  if (members.length !== 5) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
