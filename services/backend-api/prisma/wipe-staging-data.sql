-- Wipe all application data (staging/local reset). Does not drop schema.
-- Repopulate with: npm run db:seed (HQ + admin only)
TRUNCATE TABLE
  "WithdrawalRequest",
  "LedgerLine",
  "LedgerTransaction",
  "LedgerAccount",
  "PaymentRequest",
  "Payment",
  "Contribution",
  "Payout",
  "GroupMember",
  "AdminEarning",
  "Notification",
  "DeviceToken",
  "AuditLog",
  "LedgerEntry",
  "Wallet",
  "Group",
  "AdminRequest",
  "User",
  "Setting"
RESTART IDENTITY CASCADE;
