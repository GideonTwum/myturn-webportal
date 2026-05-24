# Railway Redis — Staging OTP Reliability

Redis is **recommended** for Railway staging so OTP codes and rate limits survive API redeploys and work across instances. It is **optional** locally (in-memory fallback).

---

## Why attach Redis on staging?

| Without Redis | With Redis |
|---------------|------------|
| OTP lost on every redeploy | OTP persists across deploys |
| Rate limits reset on restart | Cooldowns/limits shared |
| Idempotency in memory only | Webhook/payment locks in Redis |

---

## Setup (Railway)

### 1. Add Redis

1. Open your Railway project  
2. **New** → **Database** → **Redis**  
3. Wait until the service is healthy  

### 2. Link to API service

On your **backend API** service → **Variables**:

```env
REDIS_URL=${{ Redis.REDIS_URL }}
```

Replace `Redis` with your Redis plugin service name if different.

### 3. Redeploy API

Trigger a redeploy after saving variables.

### 4. Verify

```bash
curl https://myturn-webportal-production.up.railway.app/api/health
```

Expected:

```json
{
  "checks": { "redis": "ok" },
  "infrastructure": {
    "otpStore": "redis",
    "idempotency": "redis",
    "redis": "ok"
  }
}
```

Or:

```bash
STAGING_API_URL=https://myturn-webportal-production.up.railway.app/api npm run verify:railway
```

Startup logs (Railway deploy log) should include:

```json
{ "redis": "enabled", "otpStore": "redis" }
```

No secrets are logged.

---

## Local development (optional)

```powershell
docker run -d --name myturn-redis -p 6379:6379 redis:7-alpine
```

In `services/backend-api/.env`:

```env
REDIS_URL=redis://127.0.0.1:6379
```

Restart API. Health → `otpStore: "redis"`.

---

## Fallback when Redis is absent

| Component | Fallback |
|-----------|----------|
| OTP store | In-memory `Map` |
| OTP rate limits | In-memory |
| Idempotency | In-memory |

Health shows:

```json
{
  "checks": { "redis": "skipped" },
  "infrastructure": { "otpStore": "memory", "idempotency": "memory" }
}
```

This is acceptable for **local dev** but **not recommended** for Railway staging with testers.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `checks.redis: "error"` | Wrong `REDIS_URL`, Redis service down, or API can't reach Redis network |
| Still `otpStore: "memory"` after setting var | Redeploy API; confirm variable on **API** service not Postgres |
| OTP works once then fails after redeploy | Attach Redis — memory store was wiped |
| Health degraded, redis error | Check Railway Redis plugin logs |

---

## Related

- [RAILWAY_STAGING_SETUP.md](./RAILWAY_STAGING_SETUP.md)  
- [POST_DEPLOY_VERIFY.md](./POST_DEPLOY_VERIFY.md)  
- `npm run test:otp` — OTP unit + staging API checks  
