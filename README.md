# MyTurn MVP (monorepo)

Web portal (admin + HQ), Expo member mobile foundation, and NestJS API with Prisma/Postgres. MoMo production payments are out of scope for this MVP.

## Environment variables

### Backend (`services/backend-api`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string. On **Railway**, the deployed API should use the **private** URL (`postgres.railway.internal`). For **local Prisma** runs against Railway, use the **public** URL temporarily — see [Railway Postgres](#railway-postgres). |
| `JWT_SECRET` | **Yes** when `NODE_ENV=production` | Secret for signing/verifying JWTs (use a long random value) |
| `PORT` | No | Listen port (default `3001`; many hosts set this automatically) |
| `NODE_ENV` | Recommended for staging/prod | Set `production` for stricter validation and API error shaping |
| `CORS_ORIGIN` | Recommended for staging/prod | Comma-separated browser origins (e.g. `https://app.example.com`). If unset, any origin is allowed (dev-friendly only). |

### Frontend (`apps/web-portal`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_API_URL` | **Yes** for staging/production **builds** | Absolute API base URL including `/api`. **Must include** `https://` (see `apps/web-portal/.env.example`). Omitting the scheme breaks production: requests go to your Vercel domain and return **404**. |

### Optional scripts (`services/backend-api/scripts/*.mjs`)

| Variable | Purpose |
|----------|---------|
| `API_URL` | Base URL for join test scripts (required; no localhost default) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Defaults match seed if unchanged |
| `JOIN_TEST_PASSWORD` | Password used for synthetic join users |

Copy `services/backend-api/.env.example` → `.env`, `apps/web-portal/.env.example` → `.env.local` for local development. For **Railway Postgres migrations from your laptop**, see [Railway Postgres](#railway-postgres) and `services/backend-api/.env.railway-public.example` (do not commit credentials).

### Connected staging (all clients)

Use the **same** API URL everywhere. Templates: `.env.local.example` (local) and `.env.staging.example` (Railway/Vercel).

```bash
npm run db:seed:local     # use :local when API uses Docker Postgres (see .env.railway-public note)
npm run seed:staging:local
npm run test:e2e-staging  # API smoke (backend must be running)
```

Full ops guide: **[docs/STAGING_RUNBOOK.md](docs/STAGING_RUNBOOK.md)** · Railway: **[docs/RAILWAY_STAGING_SETUP.md](docs/RAILWAY_STAGING_SETUP.md)** · Testers: **[docs/TESTER_RUNBOOK.md](docs/TESTER_RUNBOOK.md)** · Rollout gate: **[docs/TESTER_ROLLOUT_CHECKLIST.md](docs/TESTER_ROLLOUT_CHECKLIST.md)** · Post-deploy: **[docs/POST_DEPLOY_VERIFY.md](docs/POST_DEPLOY_VERIFY.md)**

## Railway Postgres

Railway gives **two** connection URLs for the same database:

| Where | URL kind | When to use |
|-------|-----------|-------------|
| **Railway API service** (runtime) | **Private / internal** — host `postgres.railway.internal`, port `5432` | Always for the Nest app when API and Postgres run **on Railway** in the same project. Set via `${{ Postgres.DATABASE_URL }}` (adjust service name if yours is not `Postgres`). |
| **Your laptop** (Prisma CLI) | **Public / external** — host like `*.proxy.rlwy.net`, port from the dashboard (often **not** `5432`) | Only when you run `prisma migrate deploy`, `db seed`, etc. **from your machine** against that Railway database. The internal URL does **not** resolve outside Railway. |

Public connections may incur **egress** charges (Railway shows a notice in the UI). Prefer the **private** URL for deployed services.

### A. Migrations from your local machine (against Railway Postgres)

1. In Railway → Postgres → **Connect** → tab **Public Network**, copy the connection URL (masked “show” in the dashboard).
2. Put the **public** `DATABASE_URL` in `services/backend-api/.env.railway-public` (git-ignored; start from `services/backend-api/.env.railway-public.example`). Prisma npm scripts in this package load `.env`, then override with `.env.railway-public` if that file exists. **Remove or clear `.env.railway-public` when you are done** so day-to-day commands do not keep pointing at production. Alternatively, merge the public URL into `.env` temporarily (still do not commit) or export `DATABASE_URL` in the terminal for one-off runs.
3. From `services/backend-api` run:

```bash
npx prisma migrate deploy
npx prisma generate
```

From the repo root you can use `npm run db:migrate:deploy` and `npm run db:generate` when `services/backend-api/.env` and (if present) `.env.railway-public` yield the intended `DATABASE_URL`. The backend workspace Prisma scripts use `scripts/prisma-cli.cjs`, which loads those files with override semantics (see `load-env.cjs`).

### B. Backend running on Railway

- Set **`DATABASE_URL`** on the **API** service to the **private** connection string using Railway’s variable reference, e.g. `${{ Postgres.DATABASE_URL }}`.
- Do **not** point runtime at the **public** proxy URL if the service and database are in the same Railway project and a **private** URL is available.

### Prisma safety (staging / production)

- Do **not** run **`prisma migrate reset`** on staging or production unless you **intentionally** want to drop all data and recreate the schema.
- Use **`prisma migrate deploy`** (or `npm run db:migrate:deploy` from the repo root) for staging/production databases.
- Use **`prisma migrate dev`** only against **local development** databases where destructive resets are acceptable.

### Backend Prisma npm scripts (`services/backend-api`)

These mirror common Prisma commands and are also available via root `npm run db:*`:

| Script | Purpose |
|--------|---------|
| `prisma:generate` / `db:generate` | `prisma generate` |
| `prisma:migrate:deploy` | `prisma migrate deploy` (via env-aware CLI wrapper) |
| `prisma:studio` | `prisma studio` (via env-aware CLI wrapper) |

## Local development

```bash
npm install
npm run db:migrate       # local: prisma migrate dev (interactive)
# Staging / CI on a fresh or tracked DB:
npm run db:migrate:deploy
npm run db:seed
npm run dev:api
npm run dev:web
npm run build:api-client
npm run dev:mobile          # Expo member app (see apps/mobile-app/README.md)
```

### Mobile (`apps/mobile-app`)

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_API_URL` | API base including `/api` (e.g. `http://localhost:3001/api`). On a physical device, use your machine's LAN IP, not `localhost`. |

Member APIs use the standardized envelope `{ success, data }` under `/api/member/*`. OTP scaffold: `POST /api/auth/otp/request` and `POST /api/auth/otp/verify` (mock SMS in non-production).

## Database / Prisma

- **Fresh database:** run `npx prisma migrate deploy` (or `npm run db:migrate` in dev) from `services/backend-api`. The initial migration `20260429100000_init_schema` creates the full schema (including `inviteCode` on `Group`).
- **Existing databases** that were created with an older migration history may need a one-time baseline: mark migrations applied or align schema manually, then use `migrate resolve` — see [Prisma baselining](https://www.prisma.io/docs/guides/migrate/developing-and-seeding-in-development#baselining-a-database).
- **Seed:** `npm run seed` (or `npm run db:seed`) — creates HQ, admin, and five demo members (`prisma/seed.ts`). Skips existing emails (idempotent). To seed **Railway Postgres from your laptop**, put the public `DATABASE_URL` in `services/backend-api/.env.railway-public` (see `.env.railway-public.example`); the CLI merges it over `.env` and logs the target host. Default password for **new** users: `ChangeMe123!` — change before real production use.

## Staging / production build

```bash
# From repo root
export NODE_ENV=production   # or set on the host
# backend: set DATABASE_URL, JWT_SECRET, CORS_ORIGIN, PORT as needed
npm run build
```

- **Web:** set `NEXT_PUBLIC_API_URL` in the environment (or `.env.production`) **before** `next build` so the browser bundle points at the real API.
- **API:** start with `npm run start:prod -w backend-api` (or `node dist/main.js` from `services/backend-api` after `npm run build -w backend-api`).

## Mock payment routes (staging only — not MoMo)

These require JWT with role **ADMIN** or **SUPER_ADMIN**:

- `POST /api/payments/mock/contribution-payment`
- `POST /api/payouts/mock/finalize-cycle`

They are labeled `mock` in the path and in server logs (`[MOCK]`). They do **not** call mobile money.

## Build & test

```bash
npm run build    # shared → backend-api → web-portal
npm run test     # @myturn/shared unit tests (finance math)
```

## Operational logging

Structured `Logger` output (no passwords, no JWT tokens):

- **Login:** success with `userId`, `role`, `email` only on successful auth.
- **Group create (DRAFT):** `groupId`, `name`, `inviteCode`, `memberSlots`, `adminId`.
- **Mock payment:** `paymentId`, `contributionId`, `groupId`, `cycle`, `userId`.
- **Mock finalize:** `groupId`, `cycle`, `payoutId`, `recipientId`, amount, `groupCompleted`.

Failed logins return a generic `Invalid credentials` response without logging the attempted password.

## Pre–go-live checklist

- [ ] `JWT_SECRET` is long, random, and not committed to git.
- [ ] `DATABASE_URL` points to production/staging Postgres; `migrate deploy` has been run once.
- [ ] Seed not run on production, or seed passwords changed/removed.
- [ ] `CORS_ORIGIN` lists only your frontend URL(s).
- [ ] `NEXT_PUBLIC_API_URL` set at **build** time for the portal.
- [ ] HTTPS terminates in front of API and web app.
- [ ] Rotate any credentials that ever appeared in `seed.ts` or docs.
