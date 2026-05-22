# CI/CD Architecture

## Workflow

Single job `ecosystem` in `.github/workflows/ci.yml` runs on push/PR to `main`, `master`, `develop`.

```mermaid
flowchart LR
  install[Install + cache] --> db[Postgres + Redis]
  db --> migrate[Prisma migrate]
  migrate --> seed[seed local + staging]
  seed --> verify[verify-staging-seed]
  verify --> checks[Shared / API / Mobile / Web builds]
  checks --> api[Start API]
  api --> smoke[e2e-staging-smoke]
```

## Services (GitHub Actions)

| Service | Image | Purpose |
|---------|-------|---------|
| PostgreSQL 16 | `postgres:16-alpine` | Prisma + seeds |
| Redis 7 | `redis:7-alpine` | OTP store + idempotency (CI path) |

## Environment (CI)

- `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/myturn`
- `REDIS_URL=redis://localhost:6379`
- `MYTURN_LOCAL_DB=1` — never loads `.env.railway-public`
- `DEPLOYMENT_TIER=local`

## Failure policy

Pipeline **fails** if:

- Migrations fail
- Seed verification fails (`STAGING-DEMO`, `STAGING-PAY` missing)
- Typecheck or build fails (API, mobile, web)
- API does not pass `/api/health` within 90s
- E2E smoke fails (health, invite, admin, OTP, join, **contribution payment**)

## Local reproduction

```bash
docker compose up -d
# optional: docker run -d -p 6379:6379 redis:7-alpine
export DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/myturn?schema=public
export REDIS_URL=redis://127.0.0.1:6379
export MYTURN_LOCAL_DB=1
export JWT_SECRET=local-dev
npm ci
npm run build:shared && npm run build:api-client
cd services/backend-api && npx prisma migrate deploy && cd ../..
npm run db:seed:local && npm run seed:staging:local
npm run ci:verify-seed
npm run typecheck
npm run build -w backend-api
# terminal 2: npm run start -w backend-api (after build)
npm run ci:wait-api
npm run test:e2e-staging
```

See [CI_RUNBOOK.md](./CI_RUNBOOK.md) for troubleshooting.
