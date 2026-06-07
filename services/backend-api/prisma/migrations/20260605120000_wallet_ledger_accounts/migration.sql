-- Wallet-based ledger account model

CREATE TYPE "LedgerAccountType" AS ENUM (
  'SYSTEM_EXTERNAL',
  'PLATFORM_FLOAT',
  'GROUP_POOL',
  'MEMBER_WALLET',
  'ADMIN_EARNINGS',
  'MYTURN_REVENUE',
  'WITHDRAWAL_CLEARING'
);

CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "WithdrawalActorRole" AS ENUM ('MEMBER', 'ADMIN');

ALTER TYPE "PayoutStatus" ADD VALUE 'CREDITED';

ALTER TABLE "Payout" ADD COLUMN IF NOT EXISTS "creditedAt" TIMESTAMP(3);
ALTER TABLE "Payout" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS "Payout_groupId_cycleNumber_key" ON "Payout"("groupId", "cycleNumber");

ALTER TABLE "Wallet" ALTER COLUMN "currency" SET DEFAULT 'GHS';

CREATE TABLE "LedgerAccount" (
  "id" TEXT NOT NULL,
  "accountKey" TEXT NOT NULL,
  "accountType" "LedgerAccountType" NOT NULL,
  "userId" TEXT,
  "groupId" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'GHS',
  "balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LedgerAccount_accountKey_key" ON "LedgerAccount"("accountKey");
CREATE INDEX "LedgerAccount_accountType_idx" ON "LedgerAccount"("accountType");
CREATE INDEX "LedgerAccount_userId_idx" ON "LedgerAccount"("userId");
CREATE INDEX "LedgerAccount_groupId_idx" ON "LedgerAccount"("groupId");

CREATE TABLE "LedgerTransaction" (
  "id" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "referenceType" TEXT NOT NULL,
  "referenceId" TEXT NOT NULL,
  "description" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LedgerTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LedgerTransaction_idempotencyKey_key" ON "LedgerTransaction"("idempotencyKey");
CREATE INDEX "LedgerTransaction_referenceType_referenceId_idx" ON "LedgerTransaction"("referenceType", "referenceId");

CREATE TABLE "LedgerLine" (
  "id" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "delta" DECIMAL(18,2) NOT NULL,
  "balanceAfter" DECIMAL(18,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LedgerLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LedgerLine_accountId_idx" ON "LedgerLine"("accountId");
CREATE INDEX "LedgerLine_transactionId_idx" ON "LedgerLine"("transactionId");

ALTER TABLE "LedgerLine" ADD CONSTRAINT "LedgerLine_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "LedgerTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LedgerLine" ADD CONSTRAINT "LedgerLine_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "WithdrawalRequest" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorRole" "WithdrawalActorRole" NOT NULL,
  "ledgerAccountId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
  "momoNumber" TEXT NOT NULL,
  "provider" TEXT,
  "providerRef" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "confirmedById" TEXT,
  "failureReason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WithdrawalRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WithdrawalRequest_actorId_status_idx" ON "WithdrawalRequest"("actorId", "status");
CREATE INDEX "WithdrawalRequest_status_idx" ON "WithdrawalRequest"("status");
