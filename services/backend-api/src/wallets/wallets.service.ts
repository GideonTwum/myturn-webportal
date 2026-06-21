import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Legacy Wallet table — not used for financial truth.
 * Member funds live in LedgerAccount (AVAILABLE, RESERVED, DEPOSIT_ESCROW).
 */
@Injectable()
export class WalletsService {
  constructor(private prisma: PrismaService) {}

  /** Ensures a Wallet row exists for backward-compatible FKs; does not reflect ledger balances. */
  getOrCreate(userId: string) {
    return this.prisma.wallet.upsert({
      where: { userId },
      create: { userId, balance: 0, lockedBalance: 0, currency: "GHS" },
      update: {},
    });
  }
}
