# MyTurn Susu — Staging Tester Guide

**For 5 trusted testers.** This is **staging** — **no real money** moves. MoMo payments are **simulated**.

| | |
|---|---|
| **Web (admin/HQ)** | [https://myturn-webportal-web-portal.vercel.app](https://myturn-webportal-web-portal.vercel.app) |
| **Mobile** | Install the APK your team sends (EAS preview build) |
| **Test phone** | `0240000001` (or your own Ghana number) |
| **Payment test group** | Invite code **`STAGING-PAY`** |
| **Join demo group** | Invite code **`STAGING-DEMO`** |

---

## Before you start

1. You need the **MyTurn Susu staging APK** (Android) from the team — not Expo Go unless they say so.  
2. Use **mobile data or Wi‑Fi** — the app talks to our staging server on the internet.  
3. A **yellow/green banner** at the top should say **STAGING** and **no real money**.  
4. If the banner says **API offline**, stop and tell the team.

---

## Install the app (Android)

1. If you installed an older **MyTurn staging** APK, **uninstall it first** — this build installs as **MyTurn Susu** (new app ID).  
2. Open the download link from your team (Google Drive, EAS link, or direct APK).  
3. Allow **Install from unknown sources** if Android asks.  
4. Open **MyTurn Susu**.  
5. Confirm the top banner shows **STAGING · No real money**.

---

## Sign in with phone + OTP

1. Enter your phone number (Ghana format, e.g. `0240000001`).  
2. Tap **Send Code**.  
3. **Staging behavior:**  
   - You may see **“Staging code: 123456”** on screen (test environment).  
   - Or receive an SMS if the team enabled real SMS later.  
4. Enter the 6-digit code → **Verify & Continue**.  
5. If **“Wait Ns before requesting another code”** appears, wait and try again.

---

## Join the payment test group

1. When asked for an invite, enter: **`STAGING-PAY`**  
2. Complete name / join steps.  
3. You should land on **Home** and see **Staging Payments Lab** (or similar).

---

## Test contribution (mock MoMo)

**Important:** This does **not** charge your MoMo wallet.

1. Open the group → **Contribute** / **Pay via MoMo**.  
2. Confirm amount (e.g. GHS 50).  
3. Tap **Confirm & Pay**.  
4. On the next screen, read the **staging** message.  
5. Tap **Simulate MoMo approval (staging)** — this fakes approval.  
6. You should see **Payment Confirmed** with a reference number.  
7. Group/contribution status should show as paid after a short refresh.

---

## What to test (checklist)

- [ ] App opens, STAGING banner visible  
- [ ] OTP send + verify works  
- [ ] Join with `STAGING-PAY`  
- [ ] View group details  
- [ ] Start mock payment  
- [ ] Complete mock approval  
- [ ] Contribution shows paid / updated on home  
- [ ] Optional: join `STAGING-DEMO` for join-only flow  

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
- App may feel slower than final production  
- iOS build may not be available yet (Android APK first)

---

## Do not

- Do not expect real money to move  
- Do not share admin/HQ passwords publicly  
- Do not use production bank/MoMo PIN expecting a real charge  

---

## Quick reference

| Item | Value |
|------|--------|
| Invite (payments) | `STAGING-PAY` |
| Invite (join demo) | `STAGING-DEMO` |
| Test member phone | `0240000001` |
| Admin | `admin@myturn.local` / `ChangeMe123!` |
| HQ | `hq@myturn.local` / `ChangeMe123!` |

Questions? Contact your MyTurn team lead.
