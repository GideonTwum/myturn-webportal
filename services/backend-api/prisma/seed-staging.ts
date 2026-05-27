/**
 * Optional staging demo groups (STAGING-DEMO, STAGING-PAY).
 * Disabled by default — run `npm run seed:staging` only when you need mobile/join lab data.
 */
import { resolve } from "node:path";

const {
  loadPrismaEnv,
  logDatabaseUrlHost,
}: {
  loadPrismaEnv: (packageRoot?: string) => { railwayPublicLoaded: boolean };
  logDatabaseUrlHost: (prefix?: string) => void;
} = require("../load-env.cjs");

export const STAGING_INVITE_DEMO = "STAGING-DEMO";
export const STAGING_INVITE_PAY = "STAGING-PAY";

const packageRoot = resolve(__dirname, "..");
loadPrismaEnv(packageRoot);

async function main() {
  console.log("[seed:staging] skipped — demo members/groups not seeded");
  logDatabaseUrlHost("[seed:staging]");
  console.log(
    "[seed:staging] HQ/admin only: npm run db:seed (hq@myturn.local, admin@myturn.local / ChangeMe123!)",
  );
  console.log(
    "[seed:staging] To restore STAGING-DEMO / STAGING-PAY lab data, set SEED_STAGING_DEMO=1 and re-run seed:staging",
  );
}

main().catch((e) => {
  console.error("[seed:staging] failed:", e);
  process.exit(1);
});
