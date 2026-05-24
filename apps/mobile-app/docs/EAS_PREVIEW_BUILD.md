# EAS Preview Build — Android Testers

Build an **APK** that points at Railway staging so testers don't need Expo Go.

**Staging API baked into preview profile:**  
`https://myturn-webportal-production.up.railway.app/api`

---

## Prerequisites

1. [Expo account](https://expo.dev/signup)  
2. EAS CLI: `npm install -g eas-cli`  
3. Logged in: `eas login`  
4. From repo root, dependencies installed: `npm ci`  

---

## First-time project setup

```bash
cd apps/mobile-app
eas init
```

Link to an Expo project when prompted (creates `extra.eas.projectId` in app config).

---

## Build preview APK

```bash
cd apps/mobile-app
eas build --profile preview --platform android
```

- Profile **`preview`** uses `eas.json` env vars (Railway URL, staging tier, no mock UI).  
- Output: **APK** for internal distribution.  
- When build finishes, EAS shows a **download link**.

After fixing native deps or app.config, **uninstall the old APK** and install the new build.

```bash
cd apps/mobile-app
npx expo install --check
npm run build:preview
```

---

## Profiles

| Profile | Use |
|---------|-----|
| `development` | Dev client, localhost API |
| `preview` | **5 testers**, Railway staging, APK |
| `production` | Store placeholder (not for this sprint) |

---

## Updating staging URL

Edit `apps/mobile-app/eas.json` → `build.preview.env.EXPO_PUBLIC_API_URL`, then rebuild.

For local dev, use `apps/mobile-app/.env` instead — no rebuild needed.

---

## Common issues

| Issue | Fix |
|-------|-----|
| `No projectId` | Run `eas init` |
| App installs but **won't open** / instant crash | Rebuild after `expo install` fixes — especially `expo-linear-gradient` must match SDK 54 (`~15.0.8`, not v56). Run `npx expo install --check` in `apps/mobile-app`. |
| Build fails on monorepo | `eas-build-post-install` builds `@myturn/api-client`; ensure root `npm ci` ran |
| App shows wrong API | Rebuild preview profile; env is compile-time |
| Android install blocked | Enable unknown sources; use APK link from EAS |

---

## Commands summary

```bash
npm install -g eas-cli
eas login
cd apps/mobile-app
eas build --profile preview --platform android
```
