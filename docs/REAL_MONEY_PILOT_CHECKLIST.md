# Real-Money Pilot Readiness Checklist

Use this checklist **before** any pilot with real GHS. Target: controlled pilot ahead of August 17 launch.

---

## 1. Required environment variables (Railway API)

| Variable | Production value | Notes |
|----------|------------------|-------|
| `DEPLOYMENT_TIER` | `production` or `staging` (pilot) | Never `local` on hosted API |
| `NODE_ENV` | `production` | |
| `DATABASE_URL` | `${{ Postgres.DATABASE_URL }}` | Private internal URL |
| `REDIS_URL` | `${{ Redis.REDIS_URL }}` | **Required** in production |
| `JWT_SECRET` | 40+ char random | Not default/weak |
| `CORS_ORIGIN` | Vercel + app origins | Comma-separated |
| `PUBLIC_API_URL` | `https://<api>/api` | |
| `WEBHOOK_SECRET` or `WEBHOOK_SECRET_MTN` | Random secret | MTN webhook HMAC |
| `SMS_PROVIDER` | `arkesel` | Not `console` |
| `ARKESEL_API_KEY` | Live key | |
| `ARKESEL_SENDER_ID` | Approved sender | |
| `PAYMENT_PROVIDER` | `mtn-momo` | Not `mock` |
| `DISBURSEMENT_PROVIDER` | `mtn-momo` | Not `mock` |
| `MOCK_PAYMENTS` | `false` | |
| `MOCK_PAYOUTS` | `false` | |
| `STAGING_RELAX_TRUST` | `false` | Ghana Card enforced |
| `ENABLE_RECONCILIATION_JOB` | `true` | Daily snapshots + PSP poll |

### MTN Collection (contributions)

```
MTN_MOMO_SUBSCRIPTION_KEY=
MTN_MOMO_API_USER=
MTN_MOMO_API_KEY=
MTN_MOMO_ENVIRONMENT=sandbox   # then production
MTN_MOMO_TARGET_ENV=sandbox
MTN_MOMO_CALLBACK_HOST=https://<api-host>
```

### MTN Disbursement (withdrawals — separate credentials)

```
MTN_MOMO_DISBURSEMENT_SUBSCRIPTION_KEY=
MTN_MOMO_DISBURSEMENT_API_USER=
MTN_MOMO_DISBURSEMENT_API_KEY=
MTN_MOMO_DISBURSEMENT_ENVIRONMENT=sandbox
MTN_MOMO_DISBURSEMENT_CALLBACK_HOST=https://<api-host>
```

### Withdrawal limits (recommended for pilot)

```
WITHDRAWAL_MIN_AMOUNT=1
WITHDRAWAL_MAX_SINGLE_AMOUNT=500
WITHDRAWAL_MAX_DAILY_AMOUNT=1000
WITHDRAWAL_MAX_DAILY_COUNT=3
STALE_WITHDRAWAL_THRESHOLD_MS=1800000
```

---

## 2. MTN Collection checklist

- [ ] Sandbox credentials verified in MTN developer portal
- [ ] `npm run test:mtn-collection` passes (health shows `collection.configured: true`)
- [ ] Callback URL registered: `POST /api/webhooks/mtn`
- [ ] Test member has verified Ghana Card + phone on profile
- [ ] One sandbox contribution: initiate → MoMo approve → webhook/poll → contribution paid
- [ ] Payment row has `provider`, `externalRef`, linked `paymentRequestId`
- [ ] Ledger shows platform float + group pool allocation
- [ ] Duplicate webhook does not double-pay (idempotent `settle:ref:APPROVED`)

---

## 3. MTN Disbursement checklist

- [ ] Disbursement API credentials separate from Collection
- [ ] `npm run test:mtn-disbursement` passes
- [ ] Callback URL registered: `POST /api/webhooks/mtn-disbursement`
- [ ] One **member** sandbox withdrawal completes with `providerRef`
- [ ] One **admin earnings** sandbox withdrawal completes with `providerRef`
- [ ] Ledger: source wallet → clearing → `SYSTEM_EXTERNAL` on complete
- [ ] Failed disbursement returns funds to `MEMBER_WALLET` or `ADMIN_EARNINGS`
- [ ] HQ `/hq/withdrawals` shows Automatic status (no normal approval)

---

## 4. Arkesel OTP checklist

- [ ] `SMS_PROVIDER=arkesel` on Railway
- [ ] Sender ID approved by Arkesel
- [ ] `GET /api/health` → `infrastructure.sms.health: ok`
- [ ] `OTP_DEBUG_IN_RESPONSES=false`
- [ ] Ghana test phone receives OTP SMS (not console log)
- [ ] `npm run test:otp` passes on staging

---

## 5. Redis checklist

- [ ] Redis plugin attached on Railway
- [ ] `REDIS_URL` on API service
- [ ] Health: `infrastructure.redis.rolloutReady: true`
- [ ] Health: `infrastructure.otpStore: redis`
- [ ] API redeployed after Redis variable set

---

## 6. Migration checklist

- [ ] `npm run db:migrate:deploy` from laptop (public DB URL)
- [ ] Includes `ReconciliationSnapshot` table
- [ ] Seed passwords rotated (`ChangeMe123!` → strong passwords)
- [ ] No `prisma migrate reset` on hosted DB

---

## 7. Reconciliation checklist

- [ ] `ENABLE_RECONCILIATION_JOB=true`
- [ ] Daily snapshot runs at 02:00 (`GET /hq/reconciliation/latest`)
- [ ] HQ `/hq/reconciliation` shows admin withdrawal metrics
- [ ] Discrepancies logged (no auto-fix)
- [ ] Health: `infrastructure.reconciliation.latest` populated after first run

---

## 8. Withdrawal limits checklist

- [ ] Env limits set for pilot caps
- [ ] Over-limit withdrawal rejected **before** ledger hold
- [ ] Clear error shown in mobile + admin wallet UI

---

## 9. Test user flow (pilot day)

1. Member receives Arkesel OTP → logs in
2. Joins pilot group (small cohort)
3. Pays one contribution via MTN Collection
4. Admin confirms contribution visible in portal
5. Member withdraws small amount (under limits)
6. Admin withdraws small earnings amount
7. HQ checks `/hq/withdrawals` + `/hq/reconciliation`
8. HQ verifies no stale PROCESSING withdrawals in health

---

## 10. Rollback plan

| Trigger | Action |
|---------|--------|
| MTN Collection outage | Pause new payment initiations; display maintenance banner; existing pending requests expire after TTL |
| MTN Disbursement outage | Withdrawals fail safely (funds returned); pause withdraw UI copy |
| Bad deploy | Railway rollback to previous deployment |
| Data discrepancy | HQ freeze new financial ops; investigate ledger via reconciliation snapshot |

---

## 11. Incident response

### Payment succeeds but app shows pending

1. Check `PaymentRequest` by `externalRef`
2. Poll: `GET /member/payment-requests/:id`
3. Manually trigger settlement only if webhook missed (HQ tools)
4. Verify ledger `recordContributionSettlement` idempotency key

### Withdrawal fails

1. Check withdrawal status + `failureReason`
2. Confirm funds returned to source wallet (reconciliation clearing mismatch)
3. Member/admin retries after fixing MoMo number
4. HQ may **Fail stuck** if PROCESSING > threshold

### Reconciliation mismatch

1. Open `/hq/reconciliation/summary`
2. Read `discrepancies[]` — do not auto-fix
3. Compare `withdrawal clearing` vs held withdrawals (member/admin breakdown)
4. Escalate to engineering with snapshot ID from `/hq/reconciliation/latest`

---

## 12. Monitoring ownership

| Area | Owner | Check |
|------|-------|-------|
| API health | Engineering | `/api/health` every deploy |
| Stale withdrawals | HQ | `/hq/withdrawals` + health `staleProcessingCount` |
| Reconciliation | HQ / Finance | Daily snapshot + discrepancies |
| MTN webhooks | Engineering | Railway logs + webhook delivery |
| OTP delivery | Support | Arkesel dashboard + user reports |

---

## 13. Verification commands

```bash
# Local (API running)
STAGING_API_URL=http://localhost:3001/api npm run test:mtn-collection
STAGING_API_URL=http://localhost:3001/api npm run test:mtn-disbursement
npm run test -w backend-api
npm run typecheck

# Staging / pilot host
STAGING_API_URL=https://<your-api>/api npm run verify:railway
STAGING_API_URL=https://<your-api>/api npm run test:mtn-collection
STAGING_API_URL=https://<your-api>/api npm run test:mtn-disbursement
STAGING_API_URL=https://<your-api>/api npm run test:e2e-staging
STAGING_API_URL=https://<your-api>/api npm run test:otp
```

Production startup will **crash** if mock providers, console SMS, missing Redis, weak JWT, or missing webhook secret are detected when `DEPLOYMENT_TIER=production`.
