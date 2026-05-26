# Tester Rollout Checklist — Phase 1

**Do not invite the 5 testers until every required item below is checked.**

Staging API: `https://myturn-webportal-production.up.railway.app/api`  
Web portal: `https://myturn-webportal-web-portal.vercel.app`

---

## Required before rollout

### Infrastructure

- [ ] **Redis attached** on Railway ([RAILWAY_REDIS.md](./RAILWAY_REDIS.md))  
- [ ] `REDIS_URL=${{ Redis.REDIS_URL }}` on **API** service  
- [ ] API redeployed after Redis variable saved  
- [ ] `GET /api/health` → `infrastructure.redis.rolloutReady: true`  
- [ ] `infrastructure.otpStore` = **`redis`**

### Automated verification (from repo root)

```bash
STAGING_API_URL=https://myturn-webportal-production.up.railway.app/api npm run verify:railway
STRICT_ROLLOUT=1 STAGING_API_URL=https://myturn-webportal-production.up.railway.app/api npm run verify:railway
STAGING_API_URL=https://myturn-webportal-production.up.railway.app/api npm run test:otp
STAGING_API_URL=https://myturn-webportal-production.up.railway.app/api npm run test:e2e-staging
```

- [ ] `verify:railway` — all checks pass  
- [ ] `STRICT_ROLLOUT=1 verify:railway` — passes (Redis gate)  
- [ ] `test:otp` — all pass  
- [ ] `test:e2e-staging` — all pass  

### Environment

- [ ] Railway `DEPLOYMENT_TIER=staging`  
- [ ] Railway `PUBLIC_API_URL` = Railway `/api` URL  
- [ ] Railway `CORS_ORIGIN` includes Vercel web URL  
- [ ] Vercel `NEXT_PUBLIC_API_URL` = Railway `/api` URL  
- [ ] `MOCK_PAYMENTS=true`, `STAGING_RELAX_TRUST=true`  
- [ ] `SMS_PROVIDER=console` (Arkesel not required for Phase 1)  
- [ ] `PAYMENT_PROVIDER=mock` (real MTN MoMo not required for Phase 1)

### Mobile APK

- [ ] Latest EAS **preview** build completed ([EAS_PREVIEW_BUILD.md](../apps/mobile-app/docs/EAS_PREVIEW_BUILD.md))  
- [ ] `eas.json` preview → `EXPO_PUBLIC_MOCK_UI=false`  
- [ ] `EXPO_PUBLIC_API_URL` = Railway staging URL  
- [ ] APK installs on at least one real Android device  
- [ ] App opens without crash  
- [ ] Banner: **STAGING · No real money · MoMo simulated**

### Real device walkthrough

- [ ] Completed [REAL_DEVICE_SMOKE_TEST.md](./REAL_DEVICE_SMOKE_TEST.md) on a physical phone  
- [ ] Screenshots captured for team records (optional)

### Tester materials

- [ ] APK download link shared (EAS internal link)  
- [ ] [TESTER_RUNBOOK.md](./TESTER_RUNBOOK.md) shared  
- [ ] Testers understand **STAGING-DEMO** vs **STAGING-PAY**  
- [ ] Seeded payment phone (`0240000001`) documented for payment tests

---

## Invite group semantics (reminder)

| Code | Rollout use |
|------|-------------|
| `STAGING-DEMO` | Testers join this for onboarding |
| `STAGING-PAY` | Payment tests only — seeded member, not new joins |

---

## Rollout day

1. Send APK link + runbook to 5 testers  
2. Ask each to confirm STAGING banner before testing  
3. Collect feedback using runbook template  
4. Monitor Railway logs for OTP/payment errors  
5. Do **not** enable real SMS or real MoMo during Phase 1  

---

## If something fails during rollout

| Issue | Action |
|-------|--------|
| OTP lost after redeploy | Redis not attached — pause rollout, fix Redis |
| Tester can’t join STAGING-PAY | Expected — direct to STAGING-DEMO or seeded phone |
| Payment simulate fails | Check `MOCK_PAYMENTS`, re-run e2e smoke |
| Web admin empty | Check Vercel API URL + CORS |

---

## After Phase 1 rollout

Recommended next steps:

1. Collect tester feedback (1 week)  
2. Enable **Arkesel SMS** when credentials ready ([OTP_HARDENING_ROADMAP.md](./OTP_HARDENING_ROADMAP.md))  
3. MTN MoMo sandbox (Phase 2 — not Phase 1)  
4. iOS TestFlight if needed  

---

## Related

- [POST_DEPLOY_VERIFY.md](./POST_DEPLOY_VERIFY.md)  
- [RAILWAY_REDIS.md](./RAILWAY_REDIS.md)  
- [TESTER_RUNBOOK.md](./TESTER_RUNBOOK.md)  
- [REAL_DEVICE_SMOKE_TEST.md](./REAL_DEVICE_SMOKE_TEST.md)
