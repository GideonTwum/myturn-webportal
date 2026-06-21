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
```
