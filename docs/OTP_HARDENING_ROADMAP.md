# OTP Hardening Roadmap

**Current state:** `OtpService` uses `OtpStoreAdapter` (memory or Redis via `REDIS_URL`), `OtpRateLimiter`, and `SmsProvider` (`console` default). Debug codes when `debugOtpInResponses` is true.

**Implemented:**

- `otp-store.adapter.ts` — `InMemoryOtpStoreAdapter`
- `redis-otp-store.adapter.ts` — `RedisOtpStoreAdapter`
- `otp-rate-limiter.ts` — request + resend cooldown + verify limits
- `sms-provider.interface.ts` — Console / Hubtel / Arkesel stubs
- `otp-telemetry.ts` — structured OTP events

## Phase 1 — Redis store (pre-production)

1. Add `OTP_STORE=redis` + `REDIS_URL` env vars.
2. Wire `OtpService` to `OtpStoreAdapter` instead of `Map`.
3. Keep TTL 5 minutes, max 5 attempts per key.
4. Use phone normalization keys from `otpLookupKeys()` for all adapter ops.

## Phase 2 — SMS delivery

1. Choose provider (Africa's Talking, Twilio, Hubtel).
2. Implement `SmsOtpDeliveryAdapter.send()`.
3. Remove `debugCode` from API responses entirely in staging when SMS enabled.
4. Rate limit: 3 requests / phone / 15 min (Redis sliding window).

## Phase 3 — Production

1. `DEPLOYMENT_TIER=production` → `assertProductionSafety()` blocks debug flags.
2. Multi-instance API requires Redis store (mandatory).
3. Audit log `OTP_REQUEST` / `OTP_VERIFY` without logging code value.
4. Alert on verify failure spikes.

## Env vars (planned)

| Variable | Purpose |
|----------|---------|
| `OTP_STORE` | `memory` \| `redis` |
| `REDIS_URL` | Redis connection |
| `OTP_PROVIDER` | `debug` \| `sms` |
| `OTP_SMS_*` | Provider credentials |
| `OTP_RATE_LIMIT_*` | Rate limit tuning |

Do **not** enable `OTP_DEBUG_CODES` in production — startup will fail.
