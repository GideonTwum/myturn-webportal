-- Default Protection Policy (local-first): payout queue + reserve default cover audit

ALTER TABLE "GroupMember" ADD COLUMN "effectivePayoutOrder" INTEGER;
UPDATE "GroupMember" SET "effectivePayoutOrder" = "turnOrder" WHERE "effectivePayoutOrder" IS NULL;
ALTER TABLE "GroupMember" ALTER COLUMN "effectivePayoutOrder" SET NOT NULL;

ALTER TABLE "GroupMember" ADD COLUMN "defaultedAt" TIMESTAMP(3);
ALTER TABLE "GroupMember" ADD COLUMN "resolvedAt" TIMESTAMP(3);

ALTER TABLE "ContributionGuaranteeReserve" ADD COLUMN "usedForDefaultAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;

CREATE TABLE "DefaultCoverage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "contributionId" TEXT NOT NULL,
    "reserveId" TEXT,
    "coveredAmount" DECIMAL(18,2) NOT NULL,
    "missedAmount" DECIMAL(18,2) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DefaultCoverage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DefaultCoverage_idempotencyKey_key" ON "DefaultCoverage"("idempotencyKey");
CREATE INDEX "DefaultCoverage_userId_groupId_idx" ON "DefaultCoverage"("userId", "groupId");
CREATE INDEX "DefaultCoverage_contributionId_idx" ON "DefaultCoverage"("contributionId");

ALTER TABLE "DefaultCoverage" ADD CONSTRAINT "DefaultCoverage_reserveId_fkey" FOREIGN KEY ("reserveId") REFERENCES "ContributionGuaranteeReserve"("id") ON DELETE SET NULL ON UPDATE CASCADE;
