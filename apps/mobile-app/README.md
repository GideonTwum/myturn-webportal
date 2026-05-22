# MyTurn Mobile — Premium UI Demo

Investor-ready **frontend-only** Expo app based on the Stitch design system. All screens use **mock data** — no API, auth, OTP backend, or database.

## Run

```bash
# From repo root
npm run dev:mobile:clear

# Or from this package
npm run start:clear
```

Open in **Expo Go** (SDK 54).

Dev scripts use `--offline` so Metro starts without calling Expo’s API (avoids `TypeError: fetch failed` on restricted networks). When you have internet and want dependency checks: `npm run start:online -w mobile-app`.

## Demo navigation

| Step | Route |
|------|--------|
| Splash | `/` → auto → `/invite/DEMO2024` |
| Invite landing | `/invite/DEMO2024` |
| Phone | `/(onboarding)/phone` |
| OTP | `/(onboarding)/otp` (any 6 digits) |
| Group preview | `/(onboarding)/group-preview` |
| Ghana Card | `/(onboarding)/ghana-card` |
| Verification pending | `/(onboarding)/verification-pending` (auto-continues) |
| Join | `/(onboarding)/join` |
| **Home** | `/(main)/home` |
| Groups | `/(main)/groups` |
| Group detail | `/(main)/groups/grp-market` |
| Activity | `/(main)/activity` |
| Profile | `/(main)/profile` |
| Notifications | `/notifications` |
| MoMo payment | `/payment` |

## Design system

- **Colors:** `constants/tokens.ts` — Primary `#006948`, Gold `#FED01B`, Background `#F9F9FF`
- **Type:** Plus Jakarta Sans (display) + Inter (body) via `@expo-google-fonts/*`
- **Motion:** Moti + Reanimated

## Architecture

```
app/                    # Expo Router screens
components/premium/     # Reusable Stitch UI kit
mock-data/              # Mock users, groups, activity, notifications
providers/DemoProvider.tsx
constants/tokens.ts
constants/typography.ts
```

## Premium components

`PremiumCard`, `GradientButton`, `GlassHeader`, `HealthScoreRing`, `PayoutTimeline`, `TrustBadge`, `VerificationBanner`, `PremiumBottomNav`, `ActivityCard`, `ContributionProgress`, `EmptyState`, `OtpInputRow`, `ProgressTracker`, `ShimmerLoader`, `PremiumModal`, `FloatingActionButton`, `PremiumScreen`

## Future backend integration

1. Replace `DemoProvider` with auth session + `@myturn/api-client`
2. Swap `mock-data` imports for TanStack Query hooks per screen
3. Wire OTP/Ghana Card/MoMo to existing Nest APIs when ready
4. Keep `components/premium/*` unchanged — only screen data layers change

## Next UI sprint

- Lottie micro-animations on payout success
- Real avatar images (expo-image)
- Dark mode token variants
- Haptic feedback on primary CTAs
- Skeleton loaders on group list
