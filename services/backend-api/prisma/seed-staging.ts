/**
 * Idempotent staging demo seed — HQ/admin users + STAGING-DEMO / STAGING-PAY groups.
 * Never wipes the database. Safe to rerun.
 */
import { PrismaClient } from "@prisma/client";
import { resolve } from "node:path";
import { runStagingSeed } from "./seed-staging.lib";

const {
  loadPrismaEnv,
  logDatabaseUrlHost,
}: {
  loadPrismaEnv: (packageRoot?: string) => { railwayPublicLoaded: boolean };
  logDatabaseUrlHost: (prefix?: string) => void;
} = require("../load-env.cjs");

export {
  STAGING_INVITE_DEMO,
  STAGING_INVITE_PAY,
  STAGING_GROUP_SPECS,
} from "./seed-staging.lib";

const packageRoot = resolve(__dirname, "..");
loadPrismaEnv(packageRoot);
const prisma = new PrismaClient();

async function main() {
  console.log("[seed:staging] MyTurn staging demo seed (idempotent)");
  logDatabaseUrlHost("[seed:staging]");
  await runStagingSeed(prisma);
  console.log("[seed:staging] done");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("[seed:staging] failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
