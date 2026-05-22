# MyTurn — Connected Staging Demo Runbook

Use this guide to run a **single connected ecosystem**: one API, one database, three clients (mobile, admin, HQ).

## Canonical URLs (local)

| Variable | Value |
|----------|-------|
| `STAGING_API_URL` | `http://localhost:3001/api` |
| `STAGING_WEB_URL` | `http://localhost:3000` |
| Database | `postgresql://postgres:postgres@127.0.0.1:5433/myturn` |

Copy from repo root: `.env.local.example` → each app’s git-ignored env file.

## 1. Start infrastructure

```bash
docker compose up -d
```

Postgres listens on **host port 5433**.

## 2. Backend

```bash
cd services/backend-api
cp .env.example .env   # set DATABASE_URL + JWT_SECRET
npm run prisma:migrate
npm run db:seed:local        # required when `.env.railway-public` exists (plain db:seed hits Railway)
npm run seed:staging:local
# npm run db:seed / npm run seed:staging  → Railway when `.env.railway-public` is present
npm run start:dev
```

Verify: `curl http://localhost:3001/api/health`

## 3. Web portal

```bash
cd apps/web-portal
# .env.local: NEXT_PUBLIC_API_URL=http://localhost:3001/api
npm run dev
```

Open http://localhost:3000 — purple **STAGING/LOCAL** banner on admin/HQ/member.

## 4. Mobile

```bash
cd apps/mobile-app
# .env: EXPO_PUBLIC_API_URL=http://localhost:3001/api, EXPO_PUBLIC_MOCK_UI=false
npm run start
```

Physical device: Expo uses your LAN IP when `localhost` is set (see `constants/config.ts`).

## Seeded demo accounts

| Role | Email | Password | Phone |
|------|-------|----------|-------|
| HQ | `hq@myturn.local` | `ChangeMe123!` | — |
| Admin | `admin@myturn.local` | `ChangeMe123!` | — |
| Member 1 | `member@myturn.local` | `ChangeMe123!` | `0240000001` |
| Member 2 | `member2@myturn.local` | `ChangeMe123!` | `0240000002` |

## Fixed invite codes (after `seed:staging`)

| Code | Group | Purpose |
|------|-------|---------|
| `STAGING-DEMO` | Staging Demo Circle (DRAFT) | Join flow — 2/5 slots filled |
| `STAGING-PAY` | Staging Payments Lab (ACTIVE) | Contribution + mock MoMo payment |

## Demo flows

### A — Admin creates / shares invite

1. Login admin → Groups → create group or use `STAGING-DEMO`.
2. Copy invite code from group detail.
3. Confirm mobile uses **same** API URL (banner shows “API ok”).

### B — Member joins (mobile)

1. OTP: `0240000001` → code shown on screen in staging.
2. Enter invite `STAGING-DEMO` or deep link.
3. Complete join → home shows group.

### C — Mock payment

1. Member in `STAGING-PAY` → pay contribution.
2. Initiate MoMo request → mock approve (staging only).
3. Admin dashboard + HQ transactions update within poll interval (~15–20s).

## E2E smoke tests

```bash
npm run seed:staging
npm run dev:api   # separate terminal
npm run test:e2e-staging
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Invalid invite code | All clients must hit same API/DB. Run `seed:staging`. Check `/api/health` `apiBaseUrl`. |
| OTP invalid/expired | Phone must match stored digits (`024…` not stripped). Restart API after env change. |
| Admin sees group, mobile does not | `NEXT_PUBLIC_API_URL` vs `EXPO_PUBLIC_API_URL` mismatch. |
| API offline banner | Start backend; fix firewall for LAN IP on device. |
| CORS errors | Set `CORS_ORIGIN` on API to web origin. |

## Railway staging

1. Set `DEPLOYMENT_TIER=staging` on API service.
2. Point all clients to `STAGING_API_URL` (Railway public URL + `/api`).
3. Run migrations + `seed` + `seed:staging` against Railway DB once per reset.
4. Never set `MOCK_PAYMENTS=true` with `DEPLOYMENT_TIER=production`.

See also: `docs/STAGING_HARDENING_SUMMARY.md`, `docs/OTP_HARDENING_ROADMAP.md`.
