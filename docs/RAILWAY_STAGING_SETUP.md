# Railway Staging Setup — MyTurn Backend

Railway is the **staging source of truth** for the MyTurn API. Vercel (web) and Expo (mobile) must point at the same Railway public URL.

---

## 1. Railway service settings

Configure the **backend API service** in Railway:

| Setting | Value |
|---------|--------|
| **Root Directory** | *(empty — repo root)* |
| **Build Command** | `npm ci && npm run build:shared && npm run build -w backend-api` |
| **Start Command** | `node services/backend-api/dist/main.js` |
| **Health Check Path** | `/api/health` |

These are also in [`railway.toml`](../railway.toml) at the repo root.

**Do not** set Root Directory to `services/backend-api` unless you replicate monorepo workspace installs — the recommended path is **repo root** so `@myturn/shared` resolves.

**Node:** `>=20` (from root `package.json` engines).

### Build order

1. `npm ci` — install all workspaces  
2. `npm run build:shared` — compile `@myturn/shared`  
3. `npm run build -w backend-api` — `prisma generate` (prebuild) + Nest compile → `services/backend-api/dist/main.js`

`@myturn/api-client` is **not** required for the backend build (web/mobile only).

---

## 2. Required Railway environment variables

Set on the **API service** (not Postgres):

| Variable | Staging value | Notes |
|----------|---------------|--------|
| `DEPLOYMENT_TIER` | `staging` | Controls mock/staging flags |
| `NODE_ENV` | `production` | Stricter validation; still staging tier |
| `DATABASE_URL` | `${{ Postgres.DATABASE_URL }}` | **Private** internal URL |
| `JWT_SECRET` | long random string | Required |
| `CORS_ORIGIN` | `https://YOUR_VERCEL_APP.vercel.app` | Comma-separated if multiple |
| `PUBLIC_API_URL` | `https://YOUR_RAILWAY_DOMAIN/api` | Shown in health + errors |
| `SMS_PROVIDER` | `console` | OTP logged until Arkesel keys exist |
| `PAYMENT_PROVIDER` | `mock` | Mock MoMo until MTN sandbox ready |
| `MOCK_PAYMENTS` | `true` | Explicit staging mock payments |
| `MOCK_PAYOUTS` | `true` | Mock payout finalize |
| `STAGING_RELAX_TRUST` | `true` | Relaxed Ghana Card gates |
| `ENABLE_RECONCILIATION_JOB` | `false` | Optional cron off for staging |

**Optional — local dev CORS while testing Vercel + localhost:**

| Variable | Example |
|----------|---------|
| `STAGING_CORS_EXTRA` | `http://localhost:3000,http://127.0.0.1:3000` |

**Optional — Redis plugin attached:**

| Variable | Value |
|----------|--------|
| `REDIS_URL` | `${{ Redis.REDIS_URL }}` |

**Later — real providers (only when credentials exist):**

```env
SMS_PROVIDER=arkesel
ARKESEL_API_KEY=...
ARKESEL_SENDER_ID=...

PAYMENT_PROVIDER=mtn-momo
MTN_MOMO_API_KEY=...
MTN_MOMO_API_USER=...
MTN_MOMO_SUBSCRIPTION_KEY=...
MTN_MOMO_ENVIRONMENT=sandbox
MTN_MOMO_CALLBACK_HOST=https://YOUR_RAILWAY_DOMAIN

DISBURSEMENT_PROVIDER=mtn-momo
MTN_MOMO_DISBURSEMENT_SUBSCRIPTION_KEY=...
MTN_MOMO_DISBURSEMENT_API_USER=...
MTN_MOMO_DISBURSEMENT_API_KEY=...
MTN_MOMO_DISBURSEMENT_CALLBACK_HOST=https://YOUR_RAILWAY_DOMAIN

WEBHOOK_SECRET=...
ENABLE_RECONCILIATION_JOB=true
```

Verify readiness:

```bash
STAGING_API_URL=https://YOUR_RAILWAY_DOMAIN/api npm run test:mtn-collection
STAGING_API_URL=https://YOUR_RAILWAY_DOMAIN/api npm run test:mtn-disbursement
```

Health exposes provider status at `GET /api/health` → `infrastructure.payment.collection`, `infrastructure.disbursement`, `infrastructure.sms`.

See **[REAL_MONEY_PILOT_CHECKLIST.md](./REAL_MONEY_PILOT_CHECKLIST.md)** before any real-money pilot.

**Never** set `MOCK_PAYMENTS=true` or `SMS_PROVIDER=console` when `DEPLOYMENT_TIER=production` — startup will crash.

---

## 3. Postgres: private vs public URL

| Context | URL | Host example |
|---------|-----|--------------|
| **Railway API runtime** | Private | `postgres.railway.internal:5432` |
| **Laptop Prisma CLI** | Public | `*.proxy.rlwy.net:PORT` |

- Runtime **must** use `${{ Postgres.DATABASE_URL }}` (private).  
- Migrations/seeds from your laptop **must** use the **public** URL in `services/backend-api/.env.railway-public` (git-ignored).  
- **Never** run `prisma migrate reset` on Railway staging.

See also: [README Railway Postgres](../README.md#railway-postgres).

---

## 4. Migration strategy

From your laptop (with `.env.railway-public` configured):

```bash
# Repo root
npm run db:migrate:deploy
```

Or from `services/backend-api`:

```bash
npm run prisma:migrate:deploy
```

This runs `prisma migrate deploy` only — no data wipe.

**First-time Railway DB:**

1. Attach Postgres plugin  
2. Set API `DATABASE_URL` to private reference  
3. Run migrate deploy from laptop (public URL)  
4. Seed (step 5)

---

## 5. Seeding strategy

Seeds are **idempotent** (upsert) — safe to run multiple times. They **never wipe** the database.

**Order:**

```bash
# 1. Base users (HQ, admin, members)
npm run db:seed

# 2. Staging demo groups + invites
npm run seed:staging:railway
```

`seed:staging:railway` uses `.env.railway-public` for the public `DATABASE_URL`.

**Creates:**

| Item | Detail |
|------|--------|
| HQ | `hq@myturn.local` / `ChangeMe123!` |
| Admin | `admin@myturn.local` / `ChangeMe123!` |
| Members | `0240000001`, `0240000002`, etc. |
| `STAGING-DEMO` | DRAFT group, join flow |
| `STAGING-PAY` | ACTIVE group, pending contributions for MoMo mock |

Verify locally against Railway DB:

```bash
npm run ci:verify-seed
```

---

## 6. Client configuration

**Vercel (`apps/web-portal`):**

```env
NEXT_PUBLIC_API_URL=https://YOUR_RAILWAY_DOMAIN/api
NEXT_PUBLIC_DEPLOYMENT_TIER=staging
```

**Expo (`apps/mobile-app`):**

```env
EXPO_PUBLIC_API_URL=https://YOUR_RAILWAY_DOMAIN/api
EXPO_PUBLIC_DEPLOYMENT_TIER=staging
# do not set EXPO_PUBLIC_MOCK_UI=true
```

All three clients must use the **same** API URL.

---

## 7. Health check verification

After deploy:

```bash
curl https://YOUR_RAILWAY_DOMAIN/api/health
```

Expected (staging):

```json
{
  "status": "ok",
  "deploymentTier": "staging",
  "uptimeSeconds": 42,
  "checks": { "database": "ok", "redis": "skipped" },
  "featureFlags": {
    "mockPayments": true,
    "stagingRelaxTrust": true
  },
  "stagingSeed": { "status": "ok", "inviteCodes": ["STAGING-DEMO", "STAGING-PAY"] },
  "infrastructure": {
    "sms": { "provider": "console", "health": "ok" },
    "payment": { "provider": "mock", "health": "ok" },
    "otpStore": "memory"
  }
}
```

Automated checklist:

```bash
STAGING_API_URL=https://YOUR_RAILWAY_DOMAIN/api npm run verify:railway
```

---

## 8. Startup logs (Railway deploy logs)

On boot you should see JSON `startup.config` with:

- `deploymentTier`, `nodeEnv`, `databaseHost` (host only, no password)
- `redis`, `smsProvider`, `paymentProvider`
- `mockPayments`, `stagingRelaxTrust`
- Staging **warnings** for console SMS / mock payments (expected)

Secrets are **never** logged.

---

## 9. Optional Redis

**Full guide:** [RAILWAY_REDIS.md](./RAILWAY_REDIS.md)

1. Railway → **New** → **Redis**  
2. API service → Variables → `REDIS_URL=${{ Redis.REDIS_URL }}`  
3. Redeploy API  
4. Health → `infrastructure.otpStore: "redis"`, `checks.redis: "ok"`

Without Redis: memory fallback is allowed for staging; health shows `"memory"` and a warning.

---

## 10. Deployment acceptance checklist

After each deploy:

- [ ] `GET /api/health` → `status` ok/degraded, `database` ok  
- [ ] `deploymentTier` = `staging`  
- [ ] `featureFlags.mockPayments` = true  
- [ ] `GET /api/groups/invite/STAGING-DEMO` works  
- [ ] `GET /api/groups/invite/STAGING-PAY` works  
- [ ] Vercel admin login → groups load  
- [ ] Mobile OTP with `0240000001` (debug code in response if `console` SMS)  
- [ ] Mock MoMo payment on `STAGING-PAY`  
- [ ] `npm run verify:railway` passes  

---

## 11. Common errors and fixes

| Symptom | Cause | Fix |
|---------|--------|-----|
| **Build fails** `Cannot find module '@myturn/shared'` | Root Directory set to `services/backend-api` | Use repo root + build command above |
| **502 / service unavailable** | Crash on boot or wrong PORT | Check deploy logs; app binds `0.0.0.0` + `process.env.PORT` |
| **404 on `/auth/login`** | Missing `/api` prefix | Use `https://domain/api/auth/login` |
| **CORS error from Vercel** | `CORS_ORIGIN` wrong/missing | Set exact Vercel URL; add `STAGING_CORS_EXTRA` for localhost |
| **DB connection failed** | Private URL on laptop or wrong reference | Runtime: private; laptop: public in `.env.railway-public` |
| **`postgres.railway.internal` from laptop** | Using private URL locally | Use public URL in `.env.railway-public` |
| **Invalid invite code** | Seed not run on this DB | `npm run db:seed && npm run seed:staging:railway` |
| **OTP works but no SMS** | `SMS_PROVIDER=console` | Expected until Arkesel configured |
| **Production safety crash** | `MOCK_PAYMENTS=true` with `DEPLOYMENT_TIER=production` | Use `staging` tier on Railway staging |
| **Health `stagingSeed: missing`** | Seed not applied | Run seed commands against Railway DB |

---

## 12. Remaining risks

1. **Manual migrations** — not auto-run on deploy; document who runs `migrate deploy` after schema changes  
2. **Public DB URL on laptop** — protect `.env.railway-public`; never commit  
3. **Memory OTP store** — without Redis, OTP/rate limits reset on redeploy  
4. **Single Railway region** — latency for Ghana testers until edge/CDN considered  
5. **No auto-seed on deploy** — fresh Railway DB needs manual seed once  

---

## 13. Next step after Railway is stable

1. Attach Redis on Railway  
2. Enable Arkesel with real keys (`SMS_PROVIDER=arkesel`)  
3. EAS preview APK pointing at Railway URL for external testers  
4. MTN MoMo sandbox when credentials ready  
5. Browser Playwright against Vercel + Railway  

---

## Quick reference commands

```bash
# Build locally (same as Railway)
npm run build:railway

# Migrate Railway DB from laptop
npm run db:migrate:deploy

# Seed Railway DB from laptop
npm run db:seed
npm run seed:staging:railway

# Verify deployed API
STAGING_API_URL=https://xxx.up.railway.app/api npm run verify:railway
```

Template env: [`.env.staging.example`](../.env.staging.example)
