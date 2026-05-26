# Real Device Smoke Test — Staging

Run this **once on a physical Android phone** before inviting testers.  
Use the latest **MyTurn Susu** EAS preview APK.

**Staging API:** `https://myturn-webportal-production.up.railway.app/api`

---

## Prerequisites

- [ ] Latest preview APK installed ([EAS_PREVIEW_BUILD.md](../apps/mobile-app/docs/EAS_PREVIEW_BUILD.md))  
- [ ] Old MyTurn APK uninstalled if present  
- [ ] `npm run verify:railway` passed on laptop  
- [ ] `npm run test:otp` passed on laptop  

**Seeded payment tester phone:** `0240000001`  
**Onboarding invite:** `STAGING-DEMO`  
**Payment group:** `STAGING-PAY` (seeded account — not for new joins)

---

## Checklist

### 1. Install APK

| Step | Action | Expected | Pass |
|------|--------|----------|------|
| 1.1 | Open EAS download link on phone | APK downloads | ☐ |
| 1.2 | Install APK | **MyTurn Susu** appears on home screen | ☐ |
| 1.3 | Open app | Splash → onboarding or home (no instant crash) | ☐ |

**Screenshot:** Home screen icon showing MyTurn Susu

---

### 2. Staging banner

| Step | Action | Expected | Pass |
|------|--------|----------|------|
| 2.1 | Look at top banner | **STAGING · No real money · MoMo simulated** | ☐ |
| 2.2 | Confirm not “MOCK UI-only” | Connected to live staging API | ☐ |
| 2.3 | Banner not “API offline” | **API ok** suffix (if health loaded) | ☐ |

**Screenshot:** Staging banner visible

---

### 3. OTP request

| Step | Action | Expected | Pass |
|------|--------|----------|------|
| 3.1 | Enter phone `0240000001` | Accepts Ghana format | ☐ |
| 3.2 | Tap **Send Code** | Success; may show **Staging code: …** | ☐ |
| 3.3 | Tap Send again immediately | Cooldown message / wait hint | ☐ |

**Screenshot:** OTP screen with staging code (blur if sharing publicly)

---

### 4. OTP verify

| Step | Action | Expected | Pass |
|------|--------|----------|------|
| 4.1 | Enter 6-digit code | Accepts input | ☐ |
| 4.2 | Tap verify / continue | Proceeds to home or invite flow | ☐ |

---

### 5. Onboarding — STAGING-DEMO (optional second session)

Use a **different phone number** or test on a fresh install if you need a clean join.

| Step | Action | Expected | Pass |
|------|--------|----------|------|
| 5.1 | Enter invite **`STAGING-DEMO`** | Group preview loads | ☐ |
| 5.2 | Complete join steps | Lands on Home with demo group | ☐ |

**Screenshot:** Group preview or home after STAGING-DEMO join

---

### 6. Payment group — seeded account

Sign in as **`0240000001`** (seeded STAGING-PAY member).

| Step | Action | Expected | Pass |
|------|--------|----------|------|
| 6.1 | Home shows **Staging Payments Lab** | Group visible (already joined) | ☐ |
| 6.2 | Open group | Contribution / pay action available | ☐ |

**Do not** try to join via **`STAGING-PAY`** invite — expect 400 if group is full.

---

### 7. Start mock payment

| Step | Action | Expected | Pass |
|------|--------|----------|------|
| 7.1 | Tap Contribute / Pay via MoMo | Payment screen opens | ☐ |
| 7.2 | Read safety notice | **Staging — no real money** visible | ☐ |
| 7.3 | Tap **Confirm & Pay** | “Check your phone” / simulate step | ☐ |

**Screenshot:** Payment screen with staging safety notice

---

### 8. Simulate MoMo

| Step | Action | Expected | Pass |
|------|--------|----------|------|
| 8.1 | Read copy | Says staging simulate — **no real MoMo prompt** | ☐ |
| 8.2 | Tap **Simulate MoMo approval (staging)** | Processing → success | ☐ |

---

### 9. Payment confirmed

| Step | Action | Expected | Pass |
|------|--------|----------|------|
| 9.1 | Success screen | **Payment Confirmed** + reference | ☐ |
| 9.2 | Staging note visible | No real charge messaging | ☐ |
| 9.3 | Return to home | Contribution status updated (may take ~20s) | ☐ |

**Screenshot:** Payment confirmed receipt

---

### 10. Admin sees payment

On laptop browser:

| Step | Action | Expected | Pass |
|------|--------|----------|------|
| 10.1 | Login [admin web](https://myturn-webportal-web-portal.vercel.app/login) | `admin@myturn.local` / `ChangeMe123!` | ☐ |
| 10.2 | Open group / contributions | Test payment visible | ☐ |

---

### 11. HQ sees transaction

| Step | Action | Expected | Pass |
|------|--------|----------|------|
| 11.1 | Login HQ | `hq@myturn.local` / `ChangeMe123!` | ☐ |
| 11.2 | Transactions feed | Test payment appears | ☐ |

---

## Known staging limitations

- No real MoMo charge or payout  
- OTP may show on screen (not SMS)  
- **`STAGING-PAY` not joinable** for new users  
- Data may be reset by team  
- iOS not in scope for Phase 1  

---

## Sign-off

| | |
|---|---|
| **Device** | |
| **Android version** | |
| **APK build URL / ID** | |
| **Tester name** | |
| **Date** | |
| **All steps passed** | ☐ Yes ☐ No — notes: |

If all pass → proceed to [TESTER_ROLLOUT_CHECKLIST.md](./TESTER_ROLLOUT_CHECKLIST.md)

---

## Related

- [TESTER_RUNBOOK.md](./TESTER_RUNBOOK.md)  
- [TESTER_ROLLOUT_CHECKLIST.md](./TESTER_ROLLOUT_CHECKLIST.md)  
- [POST_DEPLOY_VERIFY.md](./POST_DEPLOY_VERIFY.md)
