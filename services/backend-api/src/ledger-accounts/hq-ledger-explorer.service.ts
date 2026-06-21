import { Injectable, NotFoundException } from "@nestjs/common";
import { LedgerAccountType, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  HQ_LEDGER_EXPLORABLE_ACCOUNT_TYPES,
  decimalToGhs,
  decimalToMinor,
  decodeLedgerCursor,
  encodeLedgerCursor,
  parseAccountType,
  parseExplorerLimit,
  parseOptionalDecimal,
  sanitizeLedgerMetadata,
} from "./hq-ledger-explorer.util";
import {
  findAccountIdsForOwnersAndGroups,
  findMatchingGroupIds,
  findMatchingUserIds,
  findTransactionIdsByMetadataTerm,
} from "./hq-ledger-explorer-search.util";

export type LedgerAccountsQuery = {
  accountType?: string;
  ownerId?: string;
  groupId?: string;
  search?: string;
  minBalance?: string;
  maxBalance?: string;
  limit?: string;
  cursor?: string;
};

export type LedgerTransactionsQuery = {
  dateFrom?: string;
  dateTo?: string;
  referenceType?: string;
  referenceId?: string;
  accountType?: string;
  ownerId?: string;
  groupId?: string;
  search?: string;
  limit?: string;
  cursor?: string;
};

@Injectable()
export class HqLedgerExplorerService {
  constructor(private prisma: PrismaService) {}

  async listAccounts(query: LedgerAccountsQuery) {
    const limit = parseExplorerLimit(query.limit);
    const accountType = parseAccountType(query.accountType);
    const minBalance = parseOptionalDecimal(query.minBalance, "minBalance");
    const maxBalance = parseOptionalDecimal(query.maxBalance, "maxBalance");

    const where: Prisma.LedgerAccountWhereInput = {
      accountType: accountType
        ? accountType
        : { in: HQ_LEDGER_EXPLORABLE_ACCOUNT_TYPES },
    };

    if (query.ownerId?.trim()) {
      where.userId = query.ownerId.trim();
    }
    if (query.groupId?.trim()) {
      where.groupId = query.groupId.trim();
    }
    if (minBalance || maxBalance) {
      where.balance = {};
      if (minBalance) where.balance.gte = minBalance;
      if (maxBalance) where.balance.lte = maxBalance;
    }
    if (query.search?.trim()) {
      const term = query.search.trim();
      const [userIds, groupIds] = await Promise.all([
        findMatchingUserIds(this.prisma, term),
        findMatchingGroupIds(this.prisma, term),
      ]);
      where.OR = [
        { accountKey: { contains: term, mode: "insensitive" } },
        { id: { contains: term, mode: "insensitive" } },
        ...(userIds.length ? [{ userId: { in: userIds } }] : []),
        ...(groupIds.length ? [{ groupId: { in: groupIds } }] : []),
      ];
    }

    if (query.cursor) {
      const { createdAt, id } = decodeLedgerCursor(query.cursor);
      where.AND = [
        {
          OR: [
            { updatedAt: { lt: createdAt } },
            { updatedAt: createdAt, id: { lt: id } },
          ],
        },
      ];
    }

    const [summaryRows, pageRows, totalAccounts, nonZeroAccounts] =
      await Promise.all([
        this.prisma.ledgerAccount.groupBy({
          by: ["accountType"],
          where: { accountType: { in: HQ_LEDGER_EXPLORABLE_ACCOUNT_TYPES } },
          _sum: { balance: true },
          _count: { id: true },
        }),
        this.prisma.ledgerAccount.findMany({
          where,
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          take: limit + 1,
        }),
        this.prisma.ledgerAccount.count({
          where: { accountType: { in: HQ_LEDGER_EXPLORABLE_ACCOUNT_TYPES } },
        }),
        this.prisma.ledgerAccount.count({
          where: {
            accountType: { in: HQ_LEDGER_EXPLORABLE_ACCOUNT_TYPES },
            balance: { not: 0 },
          },
        }),
      ]);

    const hasMore = pageRows.length > limit;
    const accounts = hasMore ? pageRows.slice(0, limit) : pageRows;
    const last = accounts.at(-1);
    const ownerGroupMaps = await this.loadOwnerGroupSummaries(accounts);

    const sumByType = (type: LedgerAccountType) => {
      const row = summaryRows.find((r) => r.accountType === type);
      return decimalToGhs(row?._sum.balance ?? new Prisma.Decimal(0));
    };

    return {
      summary: {
        totalAccounts,
        nonZeroAccounts,
        platformFloatGhs: sumByType(LedgerAccountType.PLATFORM_FLOAT),
        groupPoolTotalGhs: sumByType(LedgerAccountType.GROUP_POOL),
        memberAvailableTotalGhs: sumByType(
          LedgerAccountType.MEMBER_WALLET_AVAILABLE,
        ),
        memberReservedTotalGhs: sumByType(
          LedgerAccountType.MEMBER_WALLET_RESERVED,
        ),
        depositEscrowTotalGhs: sumByType(LedgerAccountType.MEMBER_DEPOSIT_ESCROW),
        myturnRevenueGhs: sumByType(LedgerAccountType.MYTURN_REVENUE),
        withdrawalClearingGhs: sumByType(LedgerAccountType.WITHDRAWAL_CLEARING),
        systemExternalGhs: sumByType(LedgerAccountType.SYSTEM_EXTERNAL),
      },
      accounts: accounts.map((a) =>
        this.mapAccount(a, ownerGroupMaps),
      ),
      nextCursor:
        hasMore && last
          ? encodeLedgerCursor(last.updatedAt, last.id)
          : null,
    };
  }

  async listTransactions(query: LedgerTransactionsQuery) {
    const limit = parseExplorerLimit(query.limit);
    const accountType = parseAccountType(query.accountType);
    const where: Prisma.LedgerTransactionWhereInput = {};

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) {
        where.createdAt.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        where.createdAt.lte = new Date(query.dateTo);
      }
    }
    if (query.referenceType?.trim()) {
      where.referenceType = query.referenceType.trim();
    }
    if (query.referenceId?.trim()) {
      where.referenceId = query.referenceId.trim();
    }
    if (query.search?.trim()) {
      const term = query.search.trim();
      const [userIds, groupIds, metadataTxIds] = await Promise.all([
        findMatchingUserIds(this.prisma, term),
        findMatchingGroupIds(this.prisma, term),
        findTransactionIdsByMetadataTerm(this.prisma, term),
      ]);
      const accountIds = await findAccountIdsForOwnersAndGroups(
        this.prisma,
        userIds,
        groupIds,
      );
      const searchOr: Prisma.LedgerTransactionWhereInput[] = [
        { description: { contains: term, mode: "insensitive" } },
        { referenceId: { contains: term, mode: "insensitive" } },
        { idempotencyKey: { contains: term, mode: "insensitive" } },
        { referenceType: { contains: term, mode: "insensitive" } },
        { id: { contains: term, mode: "insensitive" } },
      ];
      if (metadataTxIds.length) {
        searchOr.push({ id: { in: metadataTxIds } });
      }
      if (accountIds.length) {
        searchOr.push({
          lines: { some: { accountId: { in: accountIds } } },
        });
      }
      where.OR = searchOr;
    }

    if (accountType || query.ownerId?.trim() || query.groupId?.trim()) {
      const accountIds = await this.prisma.ledgerAccount.findMany({
        where: {
          ...(accountType ? { accountType } : {}),
          ...(query.ownerId?.trim() ? { userId: query.ownerId.trim() } : {}),
          ...(query.groupId?.trim() ? { groupId: query.groupId.trim() } : {}),
        },
        select: { id: true },
      });
      if (accountIds.length === 0) {
        return { transactions: [], nextCursor: null };
      }
      where.lines = {
        some: { accountId: { in: accountIds.map((a) => a.id) } },
      };
    }

    if (query.cursor) {
      const { createdAt, id } = decodeLedgerCursor(query.cursor);
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { createdAt: { lt: createdAt } },
            { createdAt, id: { lt: id } },
          ],
        },
      ];
    }

    const rows = await this.prisma.ledgerTransaction.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: {
        lines: {
          include: {
            account: {
              select: {
                id: true,
                accountType: true,
                userId: true,
                groupId: true,
                currency: true,
              },
            },
          },
        },
      },
    });

    const hasMore = rows.length > limit;
    const transactions = hasMore ? rows.slice(0, limit) : rows;
    const last = transactions.at(-1);

    return {
      transactions: transactions.map((tx) => this.mapTransaction(tx)),
      nextCursor:
        hasMore && last
          ? encodeLedgerCursor(last.createdAt, last.id)
          : null,
    };
  }

  async getTransactionDetail(id: string) {
    const tx = await this.prisma.ledgerTransaction.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            account: true,
          },
        },
      },
    });
    if (!tx) {
      throw new NotFoundException("Ledger transaction not found");
    }

    const related = await this.resolveRelatedEntities(tx.referenceType, tx.referenceId);
    const ownerGroupMaps = await this.loadOwnerGroupSummaries(
      tx.lines.map((line) => line.account),
    );

    return {
      transaction: {
        id: tx.id,
        referenceType: tx.referenceType,
        referenceId: tx.referenceId,
        description: tx.description,
        idempotencyKey: tx.idempotencyKey,
        metadata: sanitizeLedgerMetadata(tx.metadata),
        createdAt: tx.createdAt.toISOString(),
      },
      lines: tx.lines.map((line) => this.mapLine(line, ownerGroupMaps)),
      related,
    };
  }

  private async loadOwnerGroupSummaries(
    accounts: Array<{ userId: string | null; groupId: string | null }>,
  ) {
    const userIds = [
      ...new Set(accounts.map((a) => a.userId).filter((id): id is string => !!id)),
    ];
    const groupIds = [
      ...new Set(accounts.map((a) => a.groupId).filter((id): id is string => !!id)),
    ];
    const [users, groups] = await Promise.all([
      userIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              role: true,
            },
          })
        : [],
      groupIds.length
        ? this.prisma.group.findMany({
            where: { id: { in: groupIds } },
            select: { id: true, name: true, inviteCode: true },
          })
        : [],
    ]);
    return {
      users: new Map(users.map((u) => [u.id, u])),
      groups: new Map(groups.map((g) => [g.id, g])),
    };
  }

  private mapAccount(
    a: {
      id: string;
      accountKey: string;
      accountType: LedgerAccountType;
      currency: string;
      userId: string | null;
      groupId: string | null;
      balance: Prisma.Decimal;
      createdAt: Date;
      updatedAt: Date;
    },
    maps: Awaited<ReturnType<HqLedgerExplorerService["loadOwnerGroupSummaries"]>>,
  ) {
    const balance = new Prisma.Decimal(a.balance.toString());
    const owner = a.userId ? maps.users.get(a.userId) ?? null : null;
    const group = a.groupId ? maps.groups.get(a.groupId) ?? null : null;
    return {
      id: a.id,
      accountKey: a.accountKey,
      accountType: a.accountType,
      currency: a.currency,
      ownerId: a.userId,
      groupId: a.groupId,
      balanceMinor: decimalToMinor(balance),
      balanceGhs: decimalToGhs(balance),
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      owner: owner
        ? {
            id: owner.id,
            email: owner.email,
            firstName: owner.firstName,
            lastName: owner.lastName,
            phone: owner.phone,
            role: owner.role,
          }
        : null,
      group: group
        ? { id: group.id, name: group.name, inviteCode: group.inviteCode }
        : null,
    };
  }

  private mapLine(
    line: Prisma.LedgerLineGetPayload<{
      include: { account: true };
    }>,
    maps: Awaited<ReturnType<HqLedgerExplorerService["loadOwnerGroupSummaries"]>>,
  ) {
    const delta = new Prisma.Decimal(line.delta.toString());
    const balanceAfter = new Prisma.Decimal(line.balanceAfter.toString());
    const owner = line.account.userId
      ? maps.users.get(line.account.userId) ?? null
      : null;
    const group = line.account.groupId
      ? maps.groups.get(line.account.groupId) ?? null
      : null;
    return {
      id: line.id,
      accountId: line.accountId,
      accountType: line.account.accountType,
      ownerId: line.account.userId,
      groupId: line.account.groupId,
      currency: line.account.currency,
      direction: delta.gte(0) ? ("CREDIT" as const) : ("DEBIT" as const),
      amountMinor: decimalToMinor(delta.abs()),
      amountGhs: decimalToGhs(delta.abs()),
      signedAmountGhs: decimalToGhs(delta),
      balanceAfterMinor: decimalToMinor(balanceAfter),
      balanceAfterGhs: decimalToGhs(balanceAfter),
      owner: owner
        ? {
            id: owner.id,
            email: owner.email,
            firstName: owner.firstName,
            lastName: owner.lastName,
            phone: owner.phone,
            role: owner.role,
          }
        : null,
      group: group
        ? { id: group.id, name: group.name, inviteCode: group.inviteCode }
        : null,
    };
  }

  private mapTransaction(
    tx: Prisma.LedgerTransactionGetPayload<{
      include: {
        lines: {
          include: {
            account: {
              select: {
                id: true;
                accountType: true;
                userId: true;
                groupId: true;
                currency: true;
              };
            };
          };
        };
      };
    }>,
  ) {
    const totalMovementMinor = tx.lines.reduce(
      (sum, line) =>
        sum.add(new Prisma.Decimal(line.delta.toString()).abs()),
      new Prisma.Decimal(0),
    );
    return {
      id: tx.id,
      referenceType: tx.referenceType,
      referenceId: tx.referenceId,
      description: tx.description,
      idempotencyKey: tx.idempotencyKey,
      metadata: sanitizeLedgerMetadata(tx.metadata),
      createdAt: tx.createdAt.toISOString(),
      lineCount: tx.lines.length,
      totalMovementGhs: decimalToGhs(totalMovementMinor.div(2)),
      lines: tx.lines.map((line) => {
        const delta = new Prisma.Decimal(line.delta.toString());
        const balanceAfter = new Prisma.Decimal(line.balanceAfter.toString());
        return {
          id: line.id,
          accountId: line.accountId,
          accountType: line.account.accountType,
          ownerId: line.account.userId,
          groupId: line.account.groupId,
          direction: delta.gte(0) ? ("CREDIT" as const) : ("DEBIT" as const),
          amountMinor: decimalToMinor(delta.abs()),
          amountGhs: decimalToGhs(delta.abs()),
          signedAmountGhs: decimalToGhs(delta),
          balanceAfterMinor: decimalToMinor(balanceAfter),
          balanceAfterGhs: decimalToGhs(balanceAfter),
        };
      }),
    };
  }

  private async resolveRelatedEntities(
    referenceType: string,
    referenceId: string,
  ) {
    const type = referenceType.trim();
    switch (type) {
      case "Payment": {
        const payment = await this.prisma.payment.findUnique({
          where: { id: referenceId },
          select: {
            id: true,
            amount: true,
            type: true,
            status: true,
            userId: true,
            groupId: true,
            externalRef: true,
            completedAt: true,
          },
        });
        return payment
          ? {
              payment: {
                ...payment,
                amount: payment.amount.toString(),
                completedAt: payment.completedAt?.toISOString() ?? null,
              },
            }
          : {};
      }
      case "Payout": {
        const payout = await this.prisma.payout.findUnique({
          where: { id: referenceId },
          select: {
            id: true,
            amount: true,
            status: true,
            recipientId: true,
            groupId: true,
            cycleNumber: true,
            creditedAt: true,
          },
        });
        return payout
          ? {
              payout: {
                ...payout,
                amount: payout.amount.toString(),
                creditedAt: payout.creditedAt?.toISOString() ?? null,
              },
            }
          : {};
      }
      case "WithdrawalRequest": {
        const withdrawal = await this.prisma.withdrawalRequest.findUnique({
          where: { id: referenceId },
          select: {
            id: true,
            amount: true,
            status: true,
            actorId: true,
            actorRole: true,
            provider: true,
            providerRef: true,
            processedAt: true,
          },
        });
        return withdrawal
          ? {
              withdrawal: {
                ...withdrawal,
                amount: withdrawal.amount.toString(),
                processedAt: withdrawal.processedAt?.toISOString() ?? null,
              },
            }
          : {};
      }
      default:
        return {};
    }
  }
}
