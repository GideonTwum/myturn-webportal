-- Security deposit escrow on canonical ledger (replaces Wallet.lockedBalance for financial truth).
ALTER TYPE "LedgerAccountType" ADD VALUE IF NOT EXISTS 'MEMBER_DEPOSIT_ESCROW';
