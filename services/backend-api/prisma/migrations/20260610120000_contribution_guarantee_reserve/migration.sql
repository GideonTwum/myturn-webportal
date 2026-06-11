-- Contribution Guarantee Reserve: split member wallet into available + reserved ledger accounts.

-- CreateEnum
CREATE TYPE "ContributionGuaranteeReserveStatus" AS ENUM ('ACTIVE', 'RELEASED', 'FORFEITED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "LedgerAccountType" ADD VALUE 'MEMBER_WALLET_AVAILABLE';
ALTER TYPE "LedgerAccountType" ADD VALUE 'MEMBER_WALLET_RESERVED';

-- CreateTable
CREATE TABLE "ContributionGuaranteeReserve" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "cycleNumber" INTEGER NOT NULL,
    "payoutPosition" INTEGER NOT NULL,
    "originalReserveAmount" DECIMAL(18,2) NOT NULL,
    "remainingReserveAmount" DECIMAL(18,2) NOT NULL,
    "releasedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "releasePerContributionAmount" DECIMAL(18,2) NOT NULL,
    "remainingContributionCountAtCreation" INTEGER NOT NULL,
    "contributionsReleasedCount" INTEGER NOT NULL DEFAULT 0,
    "reserveBps" INTEGER NOT NULL,
    "status" "ContributionGuaranteeReserveStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContributionGuaranteeReserve_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContributionGuaranteeReserve_payoutId_key" ON "ContributionGuaranteeReserve"("payoutId");

-- CreateIndex
CREATE INDEX "ContributionGuaranteeReserve_userId_groupId_status_idx" ON "ContributionGuaranteeReserve"("userId", "groupId", "status");

-- CreateIndex
CREATE INDEX "ContributionGuaranteeReserve_groupId_status_idx" ON "ContributionGuaranteeReserve"("groupId", "status");

-- CreateIndex
CREATE INDEX "ContributionGuaranteeReserve_status_idx" ON "ContributionGuaranteeReserve"("status");

-- AddForeignKey
ALTER TABLE "ContributionGuaranteeReserve" ADD CONSTRAINT "ContributionGuaranteeReserve_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionGuaranteeReserve" ADD CONSTRAINT "ContributionGuaranteeReserve_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionGuaranteeReserve" ADD CONSTRAINT "ContributionGuaranteeReserve_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
