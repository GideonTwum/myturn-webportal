# EAS Preview Build — Android Testers

Build an **APK** that points at Railway staging so testers don't need Expo Go.

**App name:** MyTurn Susu  
**Staging API (preview profile):** `https://myturn-webportal-production.up.railway.app/api`  
**Expo project:** `@ogidi/myturn-mobile`

---

## Prerequisites

1. [Expo account](https://expo.dev/signup)  
2. EAS CLI: `npm install -g eas-cli`  
3. Logged in: `eas login`  
4. From repo root: `npm ci`  

---

## Preview profile (verified)

`apps/mobile-app/eas.json` → `build.preview`:

| Variable | Value |
|----------|--------|
| `EXPO_PUBLIC_API_URL` | Railway staging `/api` URL |
| `EXPO_PUBLIC_DEPLOYMENT_TIER` | `staging` |
| `EXPO_PUBLIC_MOCK_UI` | **`false`** |

Android: **APK**, internal distribution.  
Package: `com.myturn.susu.staging` (staging build).

---

## Build commands

From repo root:

```bash
npm ci
cd apps/mobile-app
npx expo install --check
npm run build:preview
```

Equivalent:

```bash
cd apps/mobile-app
eas build --profile preview --platform android
```

### Expected build output

1. EAS uploads project (~1 MB archive)  
2. Cloud build runs (~10–15 min)  
3. Terminal shows:
   ```
   ✔ Build finished
   🤖 Open this link on your Android devices to install:
   https://expo.dev/accounts/ogidi/projects/myturn-mobile/builds/<build-id>
   ```
4. QR code in terminal for phone scan  

---

## Share APK with testers

1. Copy the **EAS build URL** from terminal (or [expo.dev](https://expo.dev) → Projects → myturn-mobile → Builds).  
2. Send link to testers (WhatsApp, email, etc.).  
3. Tell them to **uninstall old MyTurn APK** first.  
4. Attach [TESTER_RUNBOOK.md](../../../docs/TESTER_RUNBOOK.md).  
5. Confirm they see **STAGING · No real money** banner on open.  

**Do not** share admin/HQ passwords in the same message as the APK link.

---

## First-time project setup

```bash
cd apps/mobile-app
eas init
```

Project ID is in `app.config.ts` → `extra.eas.projectId`.  
**Slug must stay `myturn-mobile`** to match the Expo project.

---

## Profiles

| Profile | Use |
|---------|-----|
| `development` | Dev client, localhost API |
| `preview` | **5 testers**, Railway staging, APK |
| `production` | Store placeholder (not Phase 1) |

---

## Updating staging URL

Edit `apps/mobile-app/eas.json` → `build.preview.env.EXPO_PUBLIC_API_URL`, then **rebuild**.

Local dev uses `apps/mobile-app/.env` — no rebuild needed.

---

## App icon / branding

Source logo: `apps/mobile-app/assets/logo-source.png`  
Regenerate icons:

```bash
python scripts/process-app-icon.py
```

Then rebuild preview APK.

---

## Common issues

| Issue | Fix |
|-------|-----|
| Slug mismatch (`myturn-susu` vs `myturn-mobile`) | Keep `slug: "myturn-mobile"` in `app.config.ts` |
| `No projectId` | Set `extra.eas.projectId` in `app.config.ts` |
| App installs but **won't open** | Run `npx expo install --check` — `expo-linear-gradient` must match SDK 54 |
| Build fails on monorepo | `eas-build-post-install` builds `@myturn/api-client` |
| Wrong API in app | Rebuild preview — env is compile-time |
| Android install blocked | Enable unknown sources; use APK link from EAS |
| Icon too large on home screen | Re-run `scripts/process-app-icon.py` and rebuild |

---

## Pre-rollout verification

Before sending to testers:

- [ ] [TESTER_ROLLOUT_CHECKLIST.md](../../../docs/TESTER_ROLLOUT_CHECKLIST.md)  
- [ ] [REAL_DEVICE_SMOKE_TEST.md](../../../docs/REAL_DEVICE_SMOKE_TEST.md) on one phone  
- [ ] `npm run verify:railway` passes  

---

## Commands summary

```bash
npm install -g eas-cli
eas login
cd apps/mobile-app
npx expo install --check
npm run build:preview
```
