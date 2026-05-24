# Post-Deploy Verification — Staging

Run this after **every Railway API deploy** and after **Vercel redeploy** when env vars change.

**Staging API:** `https://myturn-webportal-production.up.railway.app/api`  
**Web portal:** `https://myturn-webportal-web-portal.vercel.app`

---

## Automated checks (from repo root)

```bash
# 1. Railway health + seed + invites
STAGING_API_URL=https://myturn-webportal-production.up.railway.app/api npm run verify:railway

# 2. Full API smoke (API must be running — use Railway URL)
STAGING_API_URL=https://myturn-webportal-production.up.railway.app/api npm run test:e2e-staging

# 3. Playwright ecosystem flows (API)
STAGING_API_URL=https://myturn-webportal-production.up.railway.app/api npm run test:e2e-playwright

# 4. OTP unit + staging OTP API
STAGING_API_URL=https://myturn-webportal-production.up.railway.app/api npm run test:otp
```

---

## Manual checklist

### Railway API

- [ ] `GET /api/health` → `status` is `ok` or `degraded` (not 502)  
- [ ] `deploymentTier` / `environment` = **`staging`**  
- [ ] `checks.database` = **`ok`**  
- [ ] `featureFlags.mockPayments` = **`true`**  
- [ ] `featureFlags.stagingRelaxTrust` = **`true`**  
- [ ] `apiBaseUrl` = Railway URL (not `localhost`)  
- [ ] `stagingSeed.status` = **`ok`**  
- [ ] `GET /api/groups/invite/STAGING-DEMO` → 200 + inviteCode  
- [ ] `GET /api/groups/invite/STAGING-PAY` → 200 + inviteCode  

### Redis (recommended on staging)

- [ ] `checks.redis` = **`ok`**  
- [ ] `infrastructure.otpStore` = **`redis`**  
- [ ] If still `memory` → attach Redis, set `REDIS_URL`, redeploy ([RAILWAY_REDIS.md](./RAILWAY_REDIS.md))  

### Vercel web

- [ ] `NEXT_PUBLIC_API_URL` = Railway `/api` URL  
- [ ] Redeploy completed **after** env change  
- [ ] [Login](https://myturn-webportal-web-portal.vercel.app/login) as `admin@myturn.local`  
- [ ] Admin → Groups loads  
- [ ] HQ login → Transactions page loads  

### Mobile (Expo / APK)

- [ ] `EXPO_PUBLIC_API_URL` = Railway `/api` URL  
- [ ] `EXPO_PUBLIC_MOCK_UI` = **`false`**  
- [ ] Top banner: **STAGING · No real money**  
- [ ] OTP for `0240000001` works  
- [ ] Join `STAGING-PAY`  
- [ ] Mock MoMo payment completes  
- [ ] Admin sees contribution update (~20s poll)  

---

## If something fails

| Failure | Action |
|---------|--------|
| 502 on health | Railway logs, PORT, start command |
| Wrong `deploymentTier` | Set `DEPLOYMENT_TIER=staging` on Railway |
| Missing invites | `npm run db:seed && npm run seed:staging:railway` (laptop + `.env.railway-public`) |
| CORS on Vercel login | Set `CORS_ORIGIN=https://myturn-webportal-web-portal.vercel.app` on Railway |
| OTP invalid | Check Redis; retry after redeploy if memory-only |
| Web 404 on API | URL must include `/api` suffix |

---

## One-liner health curl

```bash
curl -s https://myturn-webportal-production.up.railway.app/api/health | jq .
```

---

## Related docs

- [RAILWAY_STAGING_SETUP.md](./RAILWAY_STAGING_SETUP.md)  
- [RAILWAY_REDIS.md](./RAILWAY_REDIS.md)  
- [TESTER_RUNBOOK.md](./TESTER_RUNBOOK.md)  
