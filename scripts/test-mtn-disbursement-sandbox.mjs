#!/usr/bin/env node
/**
 * MTN Disbursement sandbox readiness check.
 * Verifies API health and disbursement provider config for member + admin withdrawals.
 *
 * Usage:
 *   STAGING_API_URL=https://your-api.up.railway.app/api node scripts/test-mtn-disbursement-sandbox.mjs
 */
const BASE = (
  process.env.STAGING_API_URL ??
  process.env.API_URL ??
  "http://localhost:3001/api"
).replace(/\/+$/, "");

async function main() {
  console.log(`MTN Disbursement sandbox check → ${BASE}\n`);

  const res = await fetch(`${BASE}/health`);
  const health = await res.json();
  const disbursement = health.infrastructure?.disbursement;
  const readiness = disbursement?.readiness;

  console.log("Health status:", health.status);
  console.log("Disbursement provider:", disbursement?.provider);
  console.log("Disbursement readiness:", JSON.stringify(readiness, null, 2));
  console.log("Stale processing:", health.infrastructure?.withdrawals?.staleProcessingCount ?? 0);

  if (!readiness?.configured && readiness?.provider !== "mock-disbursement") {
    console.error("\n✗ MTN disbursement not configured. Set:");
    console.error("  DISBURSEMENT_PROVIDER=mtn-momo");
    console.error("  MTN_MOMO_DISBURSEMENT_SUBSCRIPTION_KEY, _API_USER, _API_KEY");
    console.error("  MTN_MOMO_DISBURSEMENT_CALLBACK_HOST or PUBLIC_API_URL");
    process.exit(1);
  }

  if (readiness?.provider === "mock-disbursement") {
    console.warn("\n⚠ DISBURSEMENT_PROVIDER=mock — withdrawals auto-complete locally.");
  } else {
    console.log("\n✓ MTN disbursement credentials present.");
    console.log("\nManual sandbox E2E (member + admin):");
    console.log("  1. Ensure wallet has available balance");
    console.log("  2. POST /member/withdrawals or /admin/withdrawals");
    console.log("  3. Status → PROCESSING, funds in WITHDRAWAL_CLEARING");
    console.log("  4. Webhook POST /api/webhooks/mtn-disbursement OR poll");
    console.log("  5. Status → COMPLETED with providerRef");
    console.log("  6. Ledger: clearing → SYSTEM_EXTERNAL");
    console.log("\nFailure path: provider/webhook FAILED → funds return to source wallet");
  }

  console.log("\n✓ Disbursement sandbox readiness check complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
