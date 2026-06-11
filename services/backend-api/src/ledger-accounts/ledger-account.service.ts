import { Injectable } from "@nestjs/common";
import { LedgerAccountType, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  adminEarningsKey,
  DEFAULT_CURRENCY,
  groupPoolKey,
  memberWalletAvailableKey,
  memberWalletKey,
  memberWalletReservedKey,
  myturnRevenueKey,
  platformFloatKey,
  systemExternalKey,
  withdrawalClearingKey,
} from "./ledger-account.keys";

type Tx = Prisma.TransactionClient;

@Injectable()
export class LedgerAccountService {
  constructor(private prisma: PrismaService) {}

  async getOrCreatePlatformFloat(tx?: Tx, currency = DEFAULT_CURRENCY) {
    return this.getOrCreateByKey(
      platformFloatKey(currency),
      LedgerAccountType.PLATFORM_FLOAT,
      { currency },
      tx,
    );
  }

  async getOrCreateMyturnRevenue(tx?: Tx, currency = DEFAULT_CURRENCY) {
    return this.getOrCreateByKey(
      myturnRevenueKey(currency),
      LedgerAccountType.MYTURN_REVENUE,
      { currency },
      tx,
    );
  }

  async getOrCreateWithdrawalClearing(tx?: Tx, currency = DEFAULT_CURRENCY) {
    return this.getOrCreateByKey(
      withdrawalClearingKey(currency),
      LedgerAccountType.WITHDRAWAL_CLEARING,
      { currency },
      tx,
    );
  }

  async getOrCreateSystemExternal(tx?: Tx, currency = DEFAULT_CURRENCY) {
    return this.getOrCreateByKey(
      systemExternalKey(currency),
      LedgerAccountType.SYSTEM_EXTERNAL,
      { currency },
      tx,
    );
  }

  async getOrCreateGroupPool(groupId: string, tx?: Tx, currency = DEFAULT_CURRENCY) {
    return this.getOrCreateByKey(
      groupPoolKey(groupId, currency),
      LedgerAccountType.GROUP_POOL,
      { groupId, currency },
      tx,
    );
  }

  async getOrCreateMemberWallet(userId: string, tx?: Tx, currency = DEFAULT_CURRENCY) {
    return this.getOrCreateByKey(
      memberWalletKey(userId, currency),
      LedgerAccountType.MEMBER_WALLET,
      { userId, currency },
      tx,
    );
  }

  async getOrCreateMemberWalletAvailable(
    userId: string,
    tx?: Tx,
    currency = DEFAULT_CURRENCY,
  ) {
    return this.getOrCreateByKey(
      memberWalletAvailableKey(userId, currency),
      LedgerAccountType.MEMBER_WALLET_AVAILABLE,
      { userId, currency },
      tx,
    );
  }

  async getOrCreateMemberWalletReserved(
    userId: string,
    tx?: Tx,
    currency = DEFAULT_CURRENCY,
  ) {
    return this.getOrCreateByKey(
      memberWalletReservedKey(userId, currency),
      LedgerAccountType.MEMBER_WALLET_RESERVED,
      { userId, currency },
      tx,
    );
  }

  /** @deprecated LEGACY_ADMIN_EARNINGS — no new allocations after wallet simplification. */
  async getOrCreateAdminEarnings(userId: string, tx?: Tx, currency = DEFAULT_CURRENCY) {
    return this.getOrCreateByKey(
      adminEarningsKey(userId, currency),
      LedgerAccountType.ADMIN_EARNINGS,
      { userId, currency },
      tx,
    );
  }

  async getBalance(accountId: string, tx?: Tx) {
    const db = tx ?? this.prisma;
    const row = await db.ledgerAccount.findUnique({ where: { id: accountId } });
    return row?.balance ?? new Prisma.Decimal(0);
  }

  async getByKey(accountKey: string, tx?: Tx) {
    const db = tx ?? this.prisma;
    return db.ledgerAccount.findUnique({ where: { accountKey } });
  }

  private async getOrCreateByKey(
    accountKey: string,
    accountType: LedgerAccountType,
    fields: { userId?: string; groupId?: string; currency: string },
    tx?: Tx,
  ) {
    const db = tx ?? this.prisma;
    const existing = await db.ledgerAccount.findUnique({ where: { accountKey } });
    if (existing) return existing;
    return db.ledgerAccount.create({
      data: {
        accountKey,
        accountType,
        userId: fields.userId ?? null,
        groupId: fields.groupId ?? null,
        currency: fields.currency,
        balance: 0,
      },
    });
  }
}
