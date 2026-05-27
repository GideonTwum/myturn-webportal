# Fintech Infrastructure Phase — Summary

Production-oriented staging foundations for OTP (Arkesel), MTN MoMo sandbox, payment intents, webhooks, reconciliation, shared API client, Playwright E2E, and operational health.

## 1. Arkesel OTP architecture

- **Provider:** `ArkeselSmsProvider` (`services/backend-api/src/auth/otp/arkesel-sms.provider.ts`)
- **Factory:** `SMS_PROVIDER=arkesel` via `createSmsProvider()` — default `console` for local/CI
- **Flow:** `OtpService` → `OtpRateLimiter` → Redis/memory store → Arkesel HTTP `POST` with retries, timeout, structured logs
- **Env:** `ARKESEL_API_KEY`, `ARKESEL_SENDER_ID`, `ARKESEL_BASE_URL`, `ARKESEL_TIMEOUT_MS`
- **Safety:** SMS failure deletes stored OTP and returns generic error; `debugCode` only when `debugOtpInResponses` flag is on (never in production)

## 2. Redis OTP behavior

- Store: `REDIS_URL` → `redis-otp-store.adapter`; else in-memory
- TTL: `OTP_TTL_MS` (default 5 min)
- Rate limits: resend cooldown (`OTP_RESEND_COOLDOWN_SEC`), request window, verify window
- Phone normalization + multi-key lookup (233 / 0 / 9-digit)

## 3. MTN sandbox provider architecture

- **Provider:** `MtnMomoSandboxProvider` — token, `requestToPay`, `verifyTransaction` skeleton
- **Factory:** `PAYMENT_PROVIDER=mtn|mtn-momo`
- **Env:** `MTN_MOMO_API_*`, `MTN_MOMO_ENVIRONMENT=sandbox`, callback host
- **Health:** `pingPaymentProvider()` checks credential presence

## 4. Payment intent lifecycle

- States: `CREATED → PENDING → APPROVED → RECONCILED` (+ `FAILED`, `EXPIRED`)
- **Service:** `PaymentIntentService` with `transitionIntent()` guards and audit JSON logs
- **Wiring:** `PaymentRequestsService` uses intent metadata + Prisma `PaymentRequest` status

## 5. Webhook verification strategy

- `verifyWebhookSignature()` — HMAC-SHA256, timing-safe compare
- `WebhooksService` — signature check (strict in production), idempotency keys, correlation IDs, duplicate logging
- Secrets: `WEBHOOK_SECRET` or `WEBHOOK_SECRET_<PROVIDER>`

## 6. Reconciliation architecture

- `ReconciliationService.runPendingReconciliation()` — PSP vs contribution status
- `ReconciliationJob` — cron every 30 min (disabled in production unless `ENABLE_RECONCILIATION_JOB`)
- Discrepancy structured logs — queue-ready extension point

## 7. Idempotency improvements

- Redis-backed locks + result cache (`myturn:idempotency:*`)
- `hashIdempotencyPayload()` for request hashing
- Used for mock-approve and webhook ingestion

## 8. Web api-client migration progress

| Area | Status |
|------|--------|
| `@myturn/api-client` `admin` module | Added |
| `getMyturnApi()` web wrapper | Added |
| Auth login | Migrated |
| SWR fetcher | Migrated |
| Admin: create group, group detail, contributions, payouts | Migrated |
| HQ: admin-requests, settings | Migrated |
| Join / member sign-in / member pay | Migrated |
| Remaining `apiFetch` | `api.ts` kept for session/helpers only |

## 9. Playwright coverage

- Config: `e2e/playwright/playwright.config.ts`
- Tests: `ecosystem.api.spec.ts` — Flow 1 (admin + group activate), Flow 2 (OTP + payment), Flow 3 (HQ txs/requests)
- Run: `npm run test:e2e-playwright` (API must be up + seeded)

## 10. CI upgrades

- Postgres + Redis services
- `SMS_PROVIDER=console`, `PAYMENT_PROVIDER=mock`
- Backend vitest (`npm run test -w backend-api`)
- Staging smoke + Playwright after API start

## 11. Remaining production blockers

1. Live Arkesel credentials + sender ID approval in staging
2. MTN MoMo production keys + callback URL + full webhook raw-body middleware
3. Replace mock-approve with real PSP callbacks
4. Reconciliation worker queue (BullMQ/SQS) + alerting
5. Web browser Playwright against deployed Vercel + Railway
6. OTP delivery metrics export (Prometheus/Datadog)
7. Production `DEPLOYMENT_TIER=production` safety audit on boot

## 12. Recommended next sprint

**Operator runbook:** [PHASE_2_RUNBOOK.md](./PHASE_2_RUNBOOK.md) (Arkesel → MTN sandbox → webhooks → production tier).

1. **PSP go-live:** MTN sandbox end-to-end with real `requestToPay` and webhook handlers updating intents
2. **Ledger reconciliation:** match `PaymentRequest` → `Contribution` → ledger entries automatically
3. **Arkesel staging burn-in:** send real SMS in staging, monitor delivery rates
4. **Web Playwright UI:** admin login + create group in Chromium against `web-portal`
5. **Complete api-client migration:** HQ pages, audit logs, remaining admin reads
6. **Secrets management:** Railway/Vercel secret references only, rotation runbook

## Acceptance checklist

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Arkesel OTP works in staging | Ready (set `SMS_PROVIDER=arkesel` + keys) |
| 2 | Redis OTP active | Yes when `REDIS_URL` set |
| 3 | OTP expiration/cooldown | Yes |
| 4 | MTN sandbox provider exists | Yes |
| 5 | Payment intents hardened | Yes |
| 6 | Webhook signature structure | Yes |
| 7 | Reconciliation job skeleton | Yes |
| 8 | Idempotency improved | Yes |
| 9 | Web admin key flows on api-client | Yes |
| 10 | Playwright E2E runs | Yes (API project) |
| 11 | CI validates infrastructure | Yes |
| 12 | Health exposes infra state | Yes (`/api/health` → `infrastructure`) |
| 13 | Mobile degraded-state UX | OTP cooldown + payment retry |

## Health endpoint

`GET /api/health` includes:

```json
{
  "infrastructure": {
    "otpStore": "redis|memory",
    "otpMetrics": { "deliveries", "deliveryFailures", "requests", "verifications" },
    "sms": { "provider": "arkesel|console", "health": "ok|unconfigured|error" },
    "payment": { "provider": "mock|mtn-momo", "health": "ok|unconfigured|error" },
    "webhooks": { "signatureVerification": true, "replayProtection": "idempotency" },
    "reconciliation": { "enabled": true, "schedule": "*/30 * * * *" }
  }
}
```
