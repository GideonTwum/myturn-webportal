-- AlterTable
ALTER TABLE "Group" ADD COLUMN "daysPerCycle" INTEGER NOT NULL DEFAULT 1;

-- Platform standard is 10% service margin (was 5% in initial schema default).
UPDATE "Group" SET "serviceMarginBps" = 1000;

-- AlterTable
ALTER TABLE "Contribution" ADD COLUMN "expectedDayCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Contribution" ADD COLUMN "paidDayCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill: one-shot-paid rows were modelled as a full cycle in one payment.
UPDATE "Contribution"
SET "paidDayCount" = "expectedDayCount"
WHERE "status" = 'PAID';
