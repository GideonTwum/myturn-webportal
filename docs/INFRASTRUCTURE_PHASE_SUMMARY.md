# Infrastructure Phase — Summary

## 1. CI/CD architecture

- **GitHub Actions** workflow: install → Postgres + Redis → migrate → `db:seed:local` + `seed:staging:local` → verify seed → typecheck/build (shared, API, mobile, web) → start API → **e2e-staging-smoke** (includes contribution payment).
- Docs: [CI_ARCHITECTURE.md](./CI_ARCHITECTURE.md), [CI_RUNBOOK.md](./CI_RUNBOOK.md).

## 2. Redis OTP architecture

```
OtpService
  → OtpRateLimiter (Redis or memory)
  → OtpStoreAdapter
       → InMemoryOtpStoreAdapter (no REDIS_URL)
       → RedisOtpStoreAdapter (REDIS_URL)
  → SmsProvider
       → ConsoleSmsProvider (default)
       → HubtelSmsProvider / ArkeselSmsProvider (stubs)
```

Env: `REDIS_URL`, `OTP_TTL_MS`, `OTP_REQUEST_LIMIT`, `OTP_RESEND_COOLDOWN_SEC`, `SMS_PROVIDER`.

## 3. SMS provider architecture

Interface: `SmsProvider.sendOtp()`. Production providers are **stubs** — no live SMS yet.

## 4. Payment provider architecture

```
PaymentProvider
  → MockPaymentProvider (default)
  → Mtn / Vodafone / AirtelTigo (placeholders)
```

`PaymentRequestsService` calls `requestToPay` on initiate; mock-approve uses **idempotency**.

## 5. Payment intent lifecycle

Domain enum `PaymentIntentStatus`: CREATED → PENDING → APPROVED | FAILED | EXPIRED → RECONCILED.

Mapped to existing `PaymentRequest` rows; metadata stores `intentStatus` + `reconciliationStatus`.

## 6. Webhook architecture

- `POST /api/webhooks/:provider` — logs event, idempotent processing skeleton.
- Signature verification **placeholder** (logged, not enforced yet).
- Production blocks `mock` webhooks.

## 7. Idempotency strategy

`IdempotencyService` — Redis or memory keys:

- `mock-approve:{requestId}:{userId}`
- `webhook:{idempotencyKey}`

Prevents duplicate mock approvals and webhook side effects.

## 8. API client unification progress

- Added `packages/api-client/src/envelope.ts` (`unwrapApiEnvelope`, `isWrappedResponse`).
- Web still uses `apiFetch`; mobile uses `createMyturnApi` — **migration roadmap** unchanged in [API_CLIENT_UNIFICATION.md](./API_CLIENT_UNIFICATION.md).

## 9. Observability improvements

- `x-correlation-id` middleware on all routes.
- Request logs include `correlationId`.
- OTP telemetry: `otp.request`, `otp.verify.*` JSON logs.
- `/api/health` exposes `infrastructure` block (otpStore, paymentProvider, redis check).

## 10. Remaining production blockers

- Live MoMo PSP (MTN/Vodafone/AirtelTigo)
- Live SMS + OTP without `debugCode`
- Webhook signature verification + ledger reconciliation jobs
- Redis required in production (multi-instance)
- Web portal on shared api-client
- Playwright UI tests

## 11. Recommended next sprint

1. Wire Hubtel/Arkesel SMS in staging with secrets.
2. First real `requestToPay` sandbox (MTN MoMo).
3. Webhook signature + reconciliation worker.
4. Migrate web admin fetchers to `@myturn/api-client`.
5. Playwright: login → pay → admin visibility.

## Acceptance checklist

| # | Criterion | Status |
|---|-----------|--------|
| 1 | GitHub Actions CI | ✅ `.github/workflows/ci.yml` |
| 2 | E2E in CI | ✅ smoke + payment flow |
| 3 | Redis OTP architecture | ✅ |
| 4 | OTP rate limits | ✅ |
| 5 | SMS adapter abstraction | ✅ |
| 6 | Payment provider abstraction | ✅ |
| 7 | Payment intent lifecycle | ✅ types + metadata |
| 8 | Webhook scaffolding | ✅ |
| 9 | Idempotency foundations | ✅ |
| 10 | Structured tracing | ✅ correlation + domain logs |
| 11 | Staging drift harder | ✅ startup validation + CI verify |
| 12 | Reliability improved | ✅ automated pipeline |
