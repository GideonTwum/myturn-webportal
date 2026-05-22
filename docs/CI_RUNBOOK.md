# CI Runbook

## When CI fails

### 1. `verify-staging-seed` / invite 404 in smoke

**Cause:** Staging groups not in the same DB the API uses.

**Fix locally:**

```bash
npm run db:seed:local
npm run seed:staging:local
npm run ci:verify-seed
```

Ensure `MYTURN_LOCAL_DB=1` or no `.env.railway-public` override when targeting local Postgres.

### 2. `wait-for-api` timeout

**Cause:** API crash on boot (JWT, Prisma, Redis).

**Fix:** Run `npm run build -w backend-api && node services/backend-api/dist/main.js` and read logs.

### 3. Payment smoke failure

**Cause:** `STAGING-PAY` not ACTIVE or no PENDING contributions for `0240000001`.

**Fix:** Re-run `npm run seed:staging:local`.

### 4. Web build fails

**Cause:** Missing `NEXT_PUBLIC_API_URL` in CI — workflow sets it to `http://localhost:3001/api`.

### 5. Redis errors in health

**Cause:** Redis service unhealthy in Actions (rare).

**Fix:** Re-run workflow; OTP falls back to memory if `REDIS_URL` unset locally.

## Commands reference

| Command | Purpose |
|---------|---------|
| `npm run ci:verify-seed` | Post-seed DB checks |
| `npm run ci:wait-api` | Poll `/api/health` |
| `npm run test:e2e-staging` | Full API ecosystem smoke |
| `npm run typecheck` | All workspaces |

## Pipeline files

- Workflow: `.github/workflows/ci.yml`
- Smoke: `scripts/e2e-staging-smoke.mjs`
- Seed verify: `scripts/verify-staging-seed.mjs`
