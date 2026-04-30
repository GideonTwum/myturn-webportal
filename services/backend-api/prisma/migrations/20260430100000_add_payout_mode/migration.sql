-- CreateEnum
CREATE TYPE "PayoutMode" AS ENUM ('DAILY', 'CYCLE');

-- AlterTable
ALTER TABLE "Group" ADD COLUMN "payoutMode" "PayoutMode" NOT NULL DEFAULT 'CYCLE';
