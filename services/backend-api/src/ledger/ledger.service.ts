import { Injectable } from "@nestjs/common";
import { LedgerEntryType, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/**
 * @deprecated Audit-only LedgerEntry rows. Financial truth is LedgerAccount + LedgerTransaction.
 */
@Injectable()
export class LedgerService {
  constructor(private prisma: PrismaService) {}

  async record(
    params: {
      type: LedgerEntryType;
      amount: Prisma.Decimal;
      userId?: string;
      groupId?: string;
      referenceType: string;
      referenceId: string;
      description?: string;
      metadata?: Prisma.InputJsonValue;
      balanceAfter?: Prisma.Decimal;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma;
    const data = {
      type: params.type,
      amount: params.amount,
      userId: params.userId,
      groupId: params.groupId,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      description: params.description,
      metadata: params.metadata,
      balanceAfter: params.balanceAfter,
    };

    if (tx) {
      return tx.ledgerEntry.create({ data });
    }
    return db.ledgerEntry.create({ data });
  }

  listForGroup(groupId: string, take = 50) {
    return this.prisma.ledgerEntry.findMany({
      where: { groupId },
      orderBy: { createdAt: "desc" },
      take,
    });
  }
}
