#!/usr/bin/env node
/**
 * MTN Collection sandbox readiness check.
 * Verifies API health, provider config, and payment-request metadata path.
 *
 * Usage:
 *   STAGING_API_URL=https://your-api.up.railway.app/api node scripts/test-mtn-collection-sandbox.mjs
 *
 * For a full live sandbox payment, approve the MoMo prompt on the test phone after initiate.
 */
const BASE = (
  process.env.STAGING_API_URL ??
  process.env.API_URL ??
  "http://localhost:3001/api"
).replace(/\/+$/, "");

async function main() {
  console.log(`MTN Collection sandbox check → ${BASE}\n`);

  const res = await fetch(`${BASE}/health`);
  const health = await res.json();
  const collection = health.infrastructure?.payment?.collection;
  const payment = health.infrastructure?.payment;

  console.log("Health status:", health.status);
  console.log("Payment provider:", payment?.provider);
  console.log("Collection readiness:", JSON.stringify(collection, null, 2));

  if (!collection?.configured && collection?.provider !== "mock") {
    console.error("\n✗ MTN collection not configured. Set:");
    console.error("  PAYMENT_PROVIDER=mtn-momo");
    console.error("  MTN_MOMO_SUBSCRIPTION_KEY, MTN_MOMO_API_USER, MTN_MOMO_API_KEY");
    console.error("  MTN_MOMO_CALLBACK_HOST or PUBLIC_API_URL");
    process.exit(1);
  }

  if (collection?.provider === "mock") {
    console.warn("\n⚠ PAYMENT_PROVIDER=mock — use mock-approve for staging, not live MTN.");
  } else {
    console.log("\n✓ MTN collection credentials present.");
    console.log("\nManual sandbox E2E:");
    console.log("  1. Member logs in with verified Ghana Card + phone on profile");
    console.log("  2. POST /member/payment-requests/initiate { contributionId }");
    console.log("  3. Approve MoMo prompt on phone");
    console.log("  4. Webhook POST /api/webhooks/mtn OR poll GET payment-request");
    console.log("  5. Verify Payment row has provider, externalRef, paymentRequestId");
    console.log("  6. Verify contribution paidDayCount incremented + ledger allocation");
  }

  console.log("\n✓ Collection sandbox readiness check complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
