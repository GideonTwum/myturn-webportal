-- CreateEnum
CREATE TYPE "MemberCycleStanding" AS ENUM ('ACTIVE', 'LATE', 'DEFAULTED');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('NOT_REQUIRED', 'HELD', 'FORFEITED', 'RELEASED');

-- AlterEnum
ALTER TYPE "PaymentType" ADD VALUE 'DEPOSIT';

-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN "lockedBalance" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "cycleDefaultFlagged" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Group" ADD COLUMN "defaultGraceDays" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "Group" ADD COLUMN "allowPayoutOverride" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "GroupMember" ADD COLUMN "cycleStanding" "MemberCycleStanding" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "GroupMember" ADD COLUMN "depositAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "GroupMember" ADD COLUMN "depositStatus" "DepositStatus" NOT NULL DEFAULT 'NOT_REQUIRED';
