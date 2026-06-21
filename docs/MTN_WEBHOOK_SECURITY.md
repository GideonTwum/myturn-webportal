# MTN MoMo Webhook Security Model

MyTurn uses **provider-specific** webhook authentication. MTN native callbacks do **not** send MyTurn's custom `x-signature` HMAC.

## Provider modes

| Provider | Auth mode | Staging | Production |
|----------|-----------|---------|------------|
| `mtn`, `mtn-disbursement` | **MTN API verify** | Accept without HMAC; settle only if reference exists + MTN verify API confirms status | Same — no HMAC required |
| `mock` | **Lenient** | Accept unsigned (manual testing) | Disabled |
| Other / internal | **HMAC required** | Unsigned allowed for manual tests | `x-signature` HMAC required (`WEBHOOK_SECRET` or `WEBHOOK_SECRET_<PROVIDER>`) |

Implementation: `services/backend-api/src/webhooks/webhook-auth.ts`

## MTN collection callback flow

1. `POST /api/webhooks/mtn` receives MTN sandbox/production callback (no custom HMAC).
2. Idempotency key prevents duplicate settlement.
3. `parseWebhook()` reads callback body; if status unclear, calls **MTN verify API** (`GET /collection/v1_0/requesttopay/{ref}`).
4. Settlement applies only when verify returns `SUCCESSFUL` / `FAILED` and reference matches a pending payment request.

## MTN disbursement callback flow

1. `POST /api/webhooks/mtn-disbursement`
2. Same idempotency + reference lookup pattern via withdrawals service.

## Required env (before MTN sandbox)

```env
PUBLIC_API_URL=https://YOUR_RAILWAY_HOST.up.railway.app/api
MTN_MOMO_CALLBACK_HOST=https://YOUR_RAILWAY_HOST.up.railway.app
WEBHOOK_SECRET=<strong-secret-for-non-mtn-providers>
WEBHOOK_SECRET_MTN=<placeholder-optional-mtn-does-not-use-hmac>
```

## Sandbox callback requirements

- Railway public URL must be reachable from MTN sandbox.
- Register callback URL: `{PUBLIC_API_BASE}/webhooks/mtn` (API prefix included).
- Keep `MOCK_PAYMENTS=true` until at least one full MTN collection + webhook + ledger journal is proven.
- Test with `npm run test:mtn-collection` after credentials are set.

## Production callback requirements

- Do **not** rely on `x-signature` for MTN.
- Require: provider allowlist, known reference, MTN verify API confirmation, Redis idempotency.
- Keep strict HMAC for non-MTN providers.
- `WEBHOOK_SECRET` required at startup (`assertProductionSafety`).

## Remaining risks

1. **Callback URL drift** — `PUBLIC_API_URL` must match Railway domain after redeploy.
2. **Verify API latency** — webhook handler depends on MTN API availability for ambiguous callbacks.
3. **IP allowlist** — not implemented; consider if MTN publishes stable callback IP ranges.
4. **Hybrid misconfig** — `PAYMENT_PROVIDER=mtn-momo` + `MOCK_PAYMENTS=true` hides mobile mock-approve UX; use `PAYMENT_PROVIDER=mock` for mock UAT first.

See also: [RAILWAY_STAGING_SETUP.md](./RAILWAY_STAGING_SETUP.md), [REAL_MONEY_PILOT_CHECKLIST.md](./REAL_MONEY_PILOT_CHECKLIST.md).
