#!/usr/bin/env node
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const apiRoot = resolve(__dirname, "../services/backend-api");

process.env.MYTURN_LOCAL_DB = process.env.MYTURN_LOCAL_DB ?? "1";
const { loadPrismaEnv, logDatabaseUrlHost } = require(
  resolve(apiRoot, "load-env.cjs"),
);
loadPrismaEnv(apiRoot);

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const REQUIRED_INVITES = ["STAGING-DEMO", "STAGING-PAY"];

async function main() {
  logDatabaseUrlHost("[verify-seed]");
  const groups = await prisma.group.findMany({
    where: { inviteCode: { in: REQUIRED_INVITES } },
    select: { inviteCode: true, status: true },
  });
  const missing = REQUIRED_INVITES.filter(
    (c) => !groups.some((g) => g.inviteCode === c),
  );
  if (missing.length) {
    throw new Error(`Missing seeded groups: ${missing.join(", ")}`);
  }
  const pay = groups.find((g) => g.inviteCode === "STAGING-PAY");
  if (pay?.status !== "ACTIVE") {
    throw new Error("STAGING-PAY must be ACTIVE");
  }
  const users = await prisma.user.count({
    where: { email: { in: ["admin@myturn.local", "member@myturn.local"] } },
  });
  if (users < 2) throw new Error("Run npm run db:seed:local first");
  const pending = await prisma.contribution.count({
    where: { group: { inviteCode: "STAGING-PAY" }, status: "PENDING" },
  });
  if (pending < 1) throw new Error("Need PENDING contributions on STAGING-PAY");
  console.log("[verify-seed] OK", { groups: groups.length, pending });
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("[verify-seed] FAILED:", e?.message ?? e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
