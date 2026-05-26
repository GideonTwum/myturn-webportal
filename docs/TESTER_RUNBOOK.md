# MyTurn Susu — Staging Tester Guide

**For 5 trusted testers.** This is **staging** — **no real money** moves. MoMo payments are **simulated**.

| | |
|---|---|
| **Web (admin/HQ)** | [https://myturn-webportal-web-portal.vercel.app](https://myturn-webportal-web-portal.vercel.app) |
| **Mobile** | Install the **MyTurn Susu** APK your team sends (EAS preview build) |
| **Test phone** | `0240000001` (seeded payment tester) or your own Ghana number |
| **Join / onboarding** | Invite code **`STAGING-DEMO`** |
| **Payment testing** | Seeded account in **`STAGING-PAY`** — see below |

---

## STAGING-DEMO vs STAGING-PAY (read this first)

| Code | Purpose | Can you join? |
|------|---------|---------------|
| **`STAGING-DEMO`** | Fresh **onboarding** — invite preview, join flow, new member experience | **Yes** — use this to test signing up |
| **`STAGING-PAY`** | **Payment lab** — mock MoMo, contributions, admin/HQ visibility | **Usually no** — group is active/full |

**`STAGING-PAY` is not for new joins.** It is a pre-seeded active group used to test payments with an account the team already set up (e.g. phone `0240000001`).

If you enter `STAGING-PAY` as a new user, you may see **“This group is no longer accepting members”** — that is **expected**.

### What you should test

| Goal | What to do |
|------|------------|
| **Onboarding** | Sign in → enter **`STAGING-DEMO`** → complete join |
| **Payments** | Sign in as **`0240000001`** (or account team gave you) → open **Staging Payments Lab** → mock MoMo |

---

## Before you start

1. You need the **MyTurn Susu staging APK** (Android) — not Expo Go unless the team says so.  
2. Use **mobile data or Wi‑Fi** — the app talks to our staging server on the internet.  
3. A **banner** at the top should say **STAGING · No real money · MoMo simulated**.  
4. If the banner says **API offline**, stop and tell the team.

---

## Install the app (Android)

1. If you installed an older **MyTurn staging** APK, **uninstall it first** — this build installs as **MyTurn Susu** (new app ID).  
2. Open the download link from your team (EAS link or direct APK).  
3. Allow **Install from unknown sources** if Android asks.  
4. Open **MyTurn Susu**.  
5. Confirm the top banner shows **STAGING · No real money**.

---

## Sign in with phone + OTP

1. Enter your phone number (Ghana format, e.g. `0240000001`).  
2. Tap **Send Code**.  
3. **Staging behavior:**  
   - You may see **“Staging code: 123456”** on screen (test environment).  
   - Real SMS is **not** enabled yet — codes appear on screen or in team logs.  
4. Enter the 6-digit code → **Verify & Continue**.  
5. If **“Wait Ns before requesting another code”** appears, wait and try again (see FAQ).

---

## Test onboarding (STAGING-DEMO)

1. When asked for an invite, enter: **`STAGING-DEMO`**  
2. Review the group preview → continue join steps.  
3. You should land on **Home** with your new demo circle.

---

## Test payments (seeded STAGING-PAY account)

**Use the phone number the team gave you** (default seeded tester: `0240000001`).

1. Sign in with that phone + OTP.  
2. Open **Staging Payments Lab** (already on your account — do **not** join via invite).  
3. Tap **Contribute** / **Pay via MoMo**.  
4. Read the **“Staging — no real money”** notice.  
5. Tap **Confirm & Pay**.  
6. On the next screen, tap **Simulate MoMo approval (staging)** — this fakes approval.  
7. You should see **Payment Confirmed** with a reference number.  
8. Contribution status should update after a short refresh.

**Important:** This does **not** charge your MoMo wallet.

---

## What to test (checklist)

- [ ] App opens, STAGING banner visible  
- [ ] OTP send + verify works  
- [ ] Join with **`STAGING-DEMO`** (onboarding)  
- [ ] View group details after join  
- [ ] Sign in as seeded payment tester  
- [ ] Start mock payment in **Staging Payments Lab**  
- [ ] Complete **Simulate MoMo approval (staging)**  
- [ ] Contribution shows paid / updated on home  

---

## Tester FAQ

### Why can’t I join STAGING-PAY?

That group is **full and active** — it exists for payment testing with seeded members, not new sign-ups. Use **`STAGING-DEMO`** to test joining.

### I didn’t get an SMS code

Staging uses **console OTP** — the code may appear **on your phone screen** in the app (“Staging code: …”). Real SMS (Arkesel) is not enabled yet.

### “Wait Ns before requesting another code”

You tapped **Send Code** too soon. Wait for the countdown, then try again. This protects against spam.

### “Invalid or expired code”

- Check you entered all 6 digits correctly.  
- Codes expire after ~10 minutes — tap **Send Code** again.  
- If the team redeployed the server **without Redis**, your old code may be invalid — request a new code.

### “API offline” in the banner

The app cannot reach staging. Check internet, or tell the team — the server may be down.

### Will real money leave my MoMo?

**No.** Staging always simulates payments. You must tap **Simulate MoMo approval (staging)** — there is no real MoMo prompt.

### App crashed on open

Uninstall any old MyTurn APK and install the latest **MyTurn Susu** build from the team.

---

## Admin verification (team only)

**Admin web login**

- URL: [https://myturn-webportal-web-portal.vercel.app/login](https://myturn-webportal-web-portal.vercel.app/login)  
- Email: `admin@myturn.local`  
- Password: `ChangeMe123!`  

Check **Contributions** / group for your payment.

**HQ login**

- Email: `hq@myturn.local`  
- Password: `ChangeMe123!`  
- Check **Transactions** feed for your test payment.

---

## Feedback to send the team

Report:

1. **Device** (e.g. Samsung A14, Android 14)  
2. **What you tried** (step number)  
3. **What you expected** vs **what happened**  
4. **Screenshot** if something looks wrong  
5. **Time** (approx.) and **phone number** used (last 4 digits ok)

---

## Known limitations (staging)

- **No real MoMo** — simulate button only  
- **No real payouts** to your wallet  
- **Test data** may be reset by the team  
- **OTP on screen** may appear (staging debug)  
- **`STAGING-PAY` not joinable** for new users  
- App may feel slower than final production  
- iOS build may not be available yet (Android APK first)

---

## Do not

- Do not expect real money to move  
- Do not share admin/HQ passwords publicly  
- Do not use production bank/MoMo PIN expecting a real charge  
- Do not use **`STAGING-PAY`** to test onboarding — use **`STAGING-DEMO`**

---

## Quick reference

| Item | Value |
|------|--------|
| Onboarding invite | `STAGING-DEMO` |
| Payment test group | `STAGING-PAY` (seeded accounts only) |
| Seeded payment phone | `0240000001` |
| Admin | `admin@myturn.local` / `ChangeMe123!` |
| HQ | `hq@myturn.local` / `ChangeMe123!` |

Questions? Contact your MyTurn team lead.

**Team ops:** [TESTER_ROLLOUT_CHECKLIST.md](./TESTER_ROLLOUT_CHECKLIST.md) · [REAL_DEVICE_SMOKE_TEST.md](./REAL_DEVICE_SMOKE_TEST.md)
