# Staging Mock UAT — Smoke Test

After Railway env alignment, seed, and legacy wallet repair.

## Prerequisites

Railway variables match `.env.staging.example` (mock providers, Arkesel SMS, reserve enabled).

```bash
# From laptop against Railway public DB
npm run db:seed
npm run seed:staging:railway

# Legacy wallet (if reconciliation warned)
npm run repair:legacy-wallet:staging -w backend-api
npm run repair:legacy-wallet:staging:execute -w backend-api

# Verify deploy
STAGING_API_URL=https://YOUR_RAILWAY_HOST.up.railway.app/api npm run verify:railway
```

## Smoke checklist

| # | Step | Expected |
|---|------|----------|
| 1 | HQ login `hq@myturn.local` | 200 + JWT |
| 2 | Admin login `admin@myturn.local` | 200 + JWT |
| 3 | Member OTP via Arkesel phone | SMS received, verify succeeds |
| 4 | Join `STAGING-PAY` invite | 200 + session |
| 5 | Mock contribution | mock-approve button or API settles PAID |
| 6 | HQ Ledger Explorer | Collection journal visible |
| 7 | Admin finalize cycle (when group full + paid) | Payout created |
| 8 | Member wallet | Available + reserved balances |
| 9 | Mock withdrawal | Completes via mock disbursement |
| 10 | Ledger Explorer | WITHDRAWAL_CLEARING → SYSTEM_EXTERNAL |
| 11 | HQ reconciliation | `status: ok`, no critical discrepancies |

## Client env verification

**Vercel**

```env
NEXT_PUBLIC_API_URL=https://YOUR_RAILWAY_HOST.up.railway.app/api
NEXT_PUBLIC_DEPLOYMENT_TIER=staging
```

Redeploy after changing. Confirm in browser DevTools → Network that API calls hit Railway, not Vercel `/api`.

**Expo**

```env
EXPO_PUBLIC_API_URL=https://YOUR_RAILWAY_HOST.up.railway.app/api
EXPO_PUBLIC_DEPLOYMENT_TIER=staging
EXPO_PUBLIC_MOCK_UI=false
```

Restart Metro after `.env` changes.

**CORS**

```bash
curl -sI -H "Origin: https://YOUR_VERCEL_APP.vercel.app" https://YOUR_RAILWAY_HOST.up.railway.app/api/health | findstr access-control
```

Should reflect your Vercel origin.

## Commands

```bash
npm run test -w backend-api
npm run typecheck -w backend-api
npm run typecheck -w web-portal
npm run typecheck -w mobile-app
npm run build -w @myturn/api-client
STAGING_API_URL=https://YOUR_RAILWAY_HOST.up.railway.app/api npm run verify:railway
STAGING_API_URL=https://YOUR_RAILWAY_HOST.up.railway.app/api npm run staging:uat:breaktest
STAGING_UAT=1 STAGING_API_URL=https://YOUR_RAILWAY_HOST.up.railway.app/api npm run staging:uat:default
```

Optional 50-member stress (break-test):

```bash
STAGING_UAT_LARGE=1 STAGING_API_URL=https://YOUR_RAILWAY_HOST.up.railway.app/api npm run staging:uat:breaktest
```

## Automated break-test (`staging:uat:breaktest`)

API-only harness: small-group happy path, role isolation, duplicate join, 20-member stress, member mock-approve path, withdrawal validation, reserve ledger diagnostics (`originalReserve` vs `remainingReserve` in wallet `reserveDetails` + allocation journal metadata).

## Default / completion UAT (`staging:uat:default`)

Script-only (never exposed as public API). Requires `STAGING_UAT=1` or `DEPLOYMENT_TIER=staging`, `STAGING_API_URL`, and `services/backend-api/.env.railway-public` for guarded `groupStartDate` backdate. Does **not** wipe the database.

Scenarios: post-payout default, pre-payout default, recovery, group completion.

Limit to specific scenarios:

```bash
STAGING_UAT_SCENARIOS=postPayoutDefault,completion STAGING_UAT=1 STAGING_API_URL=... npm run staging:uat:default
```

## Real-device Arkesel OTP smoke checklist

Manual checklist (Arkesel stays enabled on staging):

| # | Step | Expected |
|---|------|----------|
| 1 | Install/open app with `EXPO_PUBLIC_API_URL` pointing at staging Railway API | App loads, API calls hit Railway |
| 2 | Sign up with a **real** Ghana phone number | OTP request succeeds |
| 3 | Receive Arkesel SMS OTP | SMS arrives within ~1 minute |
| 4 | Enter OTP and complete signup | Login succeeds, member session created |
| 5 | Sign out | Session cleared |
| 6 | Log in again with same phone | OTP sent again |
| 7 | Confirm **no debug OTP** shown in app UI or API response | Production-like UX |
| 8 | Trigger OTP twice quickly | Rate limit is reasonable (not blocked forever) |
| 9 | Confirm SMS **sender ID** displays correctly on device | Matches Arkesel configured sender |

## Reserve diagnostics (UAT-02)

When investigating small-group reserves, compare:

- Ledger allocation journal: `metadata.reserveBps`, `metadata.reserved`, `metadata.net`, `metadata.cycleNumber`
- Wallet API `reserveDetails`: `originalReserveAmount`, `remainingReserveAmount`, `releasedAmount`
- Wallet balances: `availableBalance` + `reservedBalance` (read-time; remaining reserve may be lower after post-payout payments)

For a 5-member CYCLE group, cycle 1 recipient should show **2400 bps (~24%)** at creation when `CONTRIBUTION_RESERVE_MAX_BPS=3000`.

