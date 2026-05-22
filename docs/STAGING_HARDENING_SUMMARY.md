# Staging Hardening Sprint — Summary

## 1. Environment architecture

- **Single source of truth:** repo root `.env.staging.example` and `.env.local.example` define `STAGING_API_URL`, `STAGING_WEB_URL`, and per-app copies.
- **Backend tier:** `DEPLOYMENT_TIER` (`local` \| `staging` \| `production`) in `platform-env.ts`; production startup crashes if mock/trust/debug flags are unsafe.
- **Package:** `@myturn/platform-config` exports `DEMO_INVITE_CODES`, `LOCAL_DEFAULTS`, `ENV_KEYS`.

## 2. Seed system

- `npm run seed` — base users (HQ, admin, members).
- `npm run seed:staging` — deterministic groups:
  - `STAGING-DEMO` — DRAFT join demo
  - `STAGING-PAY` — ACTIVE payments lab (one paid contribution)
- Notifications + verified member flags for staging flows.

## 3. E2E testing coverage

- `scripts/e2e-staging-smoke.mjs` — `npm run test:e2e-staging`
- Flows: health, invite preview, admin login/groups, member OTP + join, member me/groups.
- No Playwright yet; API-level smoke for CI-friendly checks.

## 4. Health check architecture

- `GET /api/health` — DB + notifications subsystem, `environment`, `featureFlags`, `warnings`, `apiBaseUrl`.
- Web `EnvironmentBanner` polls health (admin/HQ/member).
- Mobile `useApiHealth` + banner offline indicator.

## 5. Feature flag hardening

- Central `getPlatformFeatureFlags()` + `assertProductionSafety()` on bootstrap.
- `MockFeaturesGuard` on mock payment, mock payout finalize, mock-approve.
- `StagingAuthGuard` on `auth/member-phone`.

## 6. Mock payment isolation

- Production tier: mock routes return 403 via guards; startup rejects `MOCK_PAYMENTS=true`.
- Health response lists `mockPayments: true` only in non-production.

## 7. OTP hardening roadmap

- Adapter interfaces under `src/auth/otp/`; full plan in `docs/OTP_HARDENING_ROADMAP.md`.
- Debug OTP gated by `debugOtpInResponses` flag, not raw `NODE_ENV` check.

## 8. API client unification roadmap

- See `docs/API_CLIENT_UNIFICATION.md`.
- Mobile uses `@myturn/api-client`; web still on `apiFetch` — types/env aligned first.

## 9. Remaining technical debt

- Web still uses separate `apiFetch` (not api-client).
- OTP in-memory (Redis not wired).
- Playwright/browser E2E not added.
- `seed:staging` does not auto-run on deploy (manual or CI step).
- Payment-request tracing could extend to structured correlation IDs.

## 10. Production blockers

- Real MoMo PSP integration
- Redis OTP + SMS provider
- Remove / gate `STAGING_RELAX_TRUST` in prod (enforced at startup)
- CORS + JWT secrets on Railway/Vercel
- Ghana Card KYC provider
- Ledger audit / reconciliation jobs

## 11. Recommended next sprint

1. Wire Redis OTP store + rate limits.
2. Migrate web admin/HQ fetchers to `@myturn/api-client`.
3. Add Playwright smoke (login + invite + payment UI).
4. CI: `docker compose` + migrate + seed + `test:e2e-staging` on PR.
5. Railway/Vercel env templates linked from runbook.

## Acceptance checklist

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Same staging backend for mobile/admin/HQ | ✅ via env examples + banners |
| 2 | Deterministic invite codes | ✅ `STAGING-DEMO`, `STAGING-PAY` |
| 3 | Full demo seed | ✅ `seed:staging` |
| 4 | E2E smoke tests | ✅ API script |
| 5 | Mock payments impossible in production | ✅ guards + assertProductionSafety |
| 6 | Environment confusion minimized | ✅ banners + health + invite diagnostics |
| 7 | API health checks | ✅ `/api/health` |
| 8 | Polling stable | ✅ staleTime + reconnect defaults |
| 9 | Demo runbook | ✅ `docs/STAGING_RUNBOOK.md` |
| 10 | Operational reliability feel | ✅ structured logging + docs |
