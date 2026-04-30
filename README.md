# MyTurn MVP (monorepo)

Web portal (admin + HQ) and NestJS API with Prisma/Postgres. MoMo and mobile app are out of scope for this MVP.

## Environment variables

### Backend (`services/backend-api`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string |
| `JWT_SECRET` | **Yes** when `NODE_ENV=production` | Secret for signing/verifying JWTs (use a long random value) |
| `PORT` | No | Listen port (default `3001`; many hosts set this automatically) |
| `NODE_ENV` | Recommended for staging/prod | Set `production` for stricter validation and API error shaping |
| `CORS_ORIGIN` | Recommended for staging/prod | Comma-separated browser origins (e.g. `https://app.example.com`). If unset, any origin is allowed (dev-friendly only). |

### Frontend (`apps/web-portal`)

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_API_URL` | **Yes** for staging/production **builds** | Public API base URL including `/api`, e.g. `https://api.example.com/api`. In **development** only, the app falls back to `http://localhost:3001/api` if unset. |

### Optional scripts (`services/backend-api/scripts/*.mjs`)

| Variable | Purpose |
|----------|---------|
| `API_URL` | Base URL for join test scripts (required; no localhost default) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Defaults match seed if unchanged |
| `JOIN_TEST_PASSWORD` | Password used for synthetic join users |

Copy `services/backend-api/.env.example` → `.env` and `apps/web-portal/.env.example` → `.env.local` for local development.

## Local development

```bash
npm install
npm run db:migrate       # local: prisma migrate dev (interactive)
# Staging / CI on a fresh or tracked DB:
npm run db:migrate:deploy
npm run db:seed
npm run dev:api
npm run dev:web
```

## Database / Prisma

- **Fresh database:** run `npx prisma migrate deploy` (or `npm run db:migrate` in dev) from `services/backend-api`. The initial migration `20260429100000_init_schema` creates the full schema (including `inviteCode` on `Group`).
- **Existing databases** that were created with an older migration history may need a one-time baseline: mark migrations applied or align schema manually, then use `migrate resolve` — see [Prisma baselining](https://www.prisma.io/docs/guides/migrate/developing-and-seeding-in-development#baselining-a-database).
- **Seed:** `npm run db:seed` — creates HQ, admin, and demo member users (passwords in `prisma/seed.ts`). **Change or disable default passwords before production.**

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
