-- CreateEnum
CREATE TYPE "MemberAuthorizationLevel" AS ENUM ('PHONE_VERIFIED', 'VERIFIED_MEMBER');
CREATE TYPE "GhanaCardVerificationStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE "PaymentRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'FAILED', 'EXPIRED');

-- AlterTable User
ALTER TABLE "User" ADD COLUMN "memberAuthorizationLevel" "MemberAuthorizationLevel" NOT NULL DEFAULT 'PHONE_VERIFIED';
ALTER TABLE "User" ADD COLUMN "ghanaCardVerificationStatus" "GhanaCardVerificationStatus" NOT NULL DEFAULT 'NOT_SUBMITTED';
ALTER TABLE "User" ADD COLUMN "ghanaCardNumberHash" TEXT;
ALTER TABLE "User" ADD COLUMN "ghanaCardLast4" TEXT;
ALTER TABLE "User" ADD COLUMN "verificationSubmittedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "verificationApprovedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "verificationRejectedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "verificationRejectionReason" TEXT;
ALTER TABLE "User" ADD COLUMN "selfieAssetKey" TEXT;
ALTER TABLE "User" ADD COLUMN "cardImageAssetKey" TEXT;
ALTER TABLE "User" ADD COLUMN "completedGroupsCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "missedContributionCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "contributionStreak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "trustScore" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "User_ghanaCardNumberHash_key" ON "User"("ghanaCardNumberHash");

-- Grandfather existing members with group membership to full participation
UPDATE "User" u
SET "memberAuthorizationLevel" = 'VERIFIED_MEMBER',
    "ghanaCardVerificationStatus" = 'VERIFIED',
    "verificationApprovedAt" = NOW()
WHERE u."role" = 'USER'
  AND EXISTS (
    SELECT 1 FROM "GroupMember" gm
    WHERE gm."userId" = u."id" AND gm."status" = 'ACTIVE'
  );

-- CreateTable PaymentRequest
CREATE TABLE "PaymentRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "contributionId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "PaymentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "externalRef" TEXT NOT NULL,
    "providerRef" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentRequest_externalRef_key" ON "PaymentRequest"("externalRef");
CREATE INDEX "PaymentRequest_userId_status_idx" ON "PaymentRequest"("userId", "status");
CREATE INDEX "PaymentRequest_contributionId_idx" ON "PaymentRequest"("contributionId");

ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "Contribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
