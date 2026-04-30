/**
 * Joins 15 test users via POST /api/groups/join (no direct DB writes).
 * Invite: MT-WXHC
 * Usage: node scripts/join-mt-wxhc-15.mjs
 */

const API = process.env.API_URL?.trim();
if (!API) {
  console.error(
    "Set API_URL to your API base, e.g. https://api.example.com/api",
  );
  process.exit(1);
}
const INVITE = "MT-WXHC";
const PASSWORD = process.env.JOIN_TEST_PASSWORD ?? "TestJoin123!";

const MEMBERS = [
  { fullName: "Kwame Asante", phone: "0240001001", email: "kwame1@test.local" },
  { fullName: "Ama Mensah", phone: "0240001002", email: "ama2@test.local" },
  { fullName: "Kojo Boateng", phone: "0240001003", email: "kojo3@test.local" },
  { fullName: "Abena Owusu", phone: "0240001004", email: "abena4@test.local" },
  { fullName: "Kofi Adu", phone: "0240001005", email: "kofi5@test.local" },
  { fullName: "Yaa Serwaa", phone: "0240001006", email: "yaa6@test.local" },
  { fullName: "Daniel Ofori", phone: "0240001007", email: "daniel7@test.local" },
  { fullName: "Akosua Agyeman", phone: "0240001008", email: "akosua8@test.local" },
  { fullName: "Nana Kwarteng", phone: "0240001009", email: "nana9@test.local" },
  { fullName: "Efua Nyarko", phone: "0240001010", email: "efua10@test.local" },
  {
    fullName: "Michael Tetteh",
    phone: "0240001011",
    email: "michael11@test.local",
  },
  {
    fullName: "Lydia Amponsah",
    phone: "0240001012",
    email: "lydia12@test.local",
  },
  { fullName: "Isaac Darko", phone: "0240001013", email: "isaac13@test.local" },
  {
    fullName: "Anita Frimpong",
    phone: "0240001014",
    email: "anita14@test.local",
  },
  {
    fullName: "Bright Opoku",
    phone: "0240001015",
    email: "bright15@test.local",
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

  const login0 = await api("POST", "/auth/login", {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!login0.ok) {
    console.error("Admin login failed:", login0.status, login0.json);
    process.exit(1);
  }
  const adminToken = login0.json.access_token;
  const mine0 = await api("GET", "/groups/mine", { token: adminToken });
  if (!mine0.ok) {
    console.error("GET /groups/mine failed:", mine0.status, mine0.json);
    process.exit(1);
  }
  const g0 = mine0.json.find((x) => x.inviteCode === INVITE);
  if (!g0) {
    console.error("Invite group not found for admin.");
    process.exit(1);
  }
  const detail0 = await api("GET", `/groups/${g0.id}`, { token: adminToken });
  if (!detail0.ok) {
    console.error("GET group failed:", detail0.status, detail0.json);
    process.exit(1);
  }
  if (detail0.json.status !== "DRAFT") {
    console.error(
      "Group must be DRAFT for invite joins. status=",
      detail0.json.status,
    );
    process.exit(1);
  }
  const targetSize = MEMBERS.length;
  if (detail0.json.memberSlots < targetSize) {
    console.log(
      `Resizing memberSlots ${detail0.json.memberSlots} → ${targetSize} (draft PATCH)…`,
    );
    const patch = await api("PATCH", `/groups/${g0.id}`, {
      token: adminToken,
      body: { memberSlots: targetSize },
    });
    if (!patch.ok) {
      console.error("PATCH group failed:", patch.status, patch.json);
      process.exit(1);
    }
    console.log("PATCH OK.\n");
  }

  const pre = await api("GET", `/groups/invite/${encodeURIComponent(INVITE)}`);
  if (!pre.ok) {
    console.error(
      "GET /groups/invite (validate code + draft + capacity) failed:",
      pre.status,
      pre.json,
    );
    process.exit(1);
  }
  console.log(
    "Invite preview (invite exists, draft, has slots):",
    JSON.stringify(pre.json, null, 2),
  );

  let okCount = 0;
  let failCount = 0;
  let skipCount = 0;

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
    const msg =
      typeof r.json?.message === "string" ? r.json.message : "";
    if (r.ok) {
      okCount++;
      console.log(`OK  ${m.fullName} (${m.email}):`, r.json?.message ?? r.json);
    } else if (
      msg.toLowerCase().includes("already a member") ||
      msg.includes("already a member")
    ) {
      skipCount++;
      console.log(`SKIP (already member) ${m.fullName} (${m.email})`);
    } else {
      failCount++;
      console.error(
        `FAIL ${m.fullName} (${m.email}):`,
        r.status,
        r.json?.message ?? r.json,
      );
    }
  }

  console.log(
    `\nSummary: ${okCount} OK, ${skipCount} skip (already in group), ${failCount} FAIL\n`,
  );

  const afterInvite = await api(
    "GET",
    `/groups/invite/${encodeURIComponent(INVITE)}`,
  );
  console.log(
    "Invite preview after joins (400 expected if full):",
    afterInvite.status,
    afterInvite.json?.message ?? afterInvite.json,
  );

  const token = adminToken;

  const mine = await api("GET", "/groups/mine", { token });
  if (!mine.ok) {
    console.error("GET /groups/mine failed:", mine.status, mine.json);
    process.exit(1);
  }
  const group = mine.json.find((g) => g.inviteCode === INVITE);
  if (!group) {
    console.error(
      "Group with invite not found in admin list. Groups:",
      mine.json.map((g) => ({
        id: g.id,
        inviteCode: g.inviteCode,
        name: g.name,
      })),
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
  console.log(
    `Group: ${detail.json.name} status=${detail.json.status} slots=${detail.json.memberSlots}`,
  );
  console.log(`Active members: ${members.length}`);
  for (const mem of members) {
    const u = mem.user;
    const label =
      [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email;
    console.log(`  turn ${mem.turnOrder}: ${label} <${u.email}>`);
  }

  const expected = MEMBERS.length;
  const canActivate =
    detail.json.status === "DRAFT" &&
    members.length === detail.json.memberSlots &&
    members.length === expected;
  console.log(
    `\nActivate-ready (draft + members === groupSize === ${expected}): ${canActivate}`,
  );

  const turnsOk =
    members.length === expected &&
    members.every((m, i) => m.turnOrder === i + 1);
  if (!turnsOk) {
    console.error(
      "Expected turn orders 1..%d sequentially (got %d members)",
      expected,
      members.length,
    );
  }

  if (members.length !== expected || failCount > 0 || !turnsOk) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
