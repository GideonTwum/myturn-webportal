import { Injectable } from "@nestjs/common";
import { LedgerEntryType, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { WalletsService } from "../wallets/wallets.service";

@Injectable()
export class LedgerService {
  constructor(
    private prisma: PrismaService,
    private wallets: WalletsService,
  ) {}

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
      /** When false, only create ledger row (e.g. deposit escrow uses lockedBalance separately). */
      applyToWallet?: boolean;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma;
    const applyToWallet = params.applyToWallet !== false;

    const run = async (client: Prisma.TransactionClient) => {
      const entry = await client.ledgerEntry.create({
        data: {
          type: params.type,
          amount: params.amount,
          userId: params.userId,
          groupId: params.groupId,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          description: params.description,
          metadata: params.metadata,
          balanceAfter: params.balanceAfter,
        },
      });
      if (params.userId && applyToWallet) {
        await this.wallets.applyLedgerDelta(
          client,
          params.userId,
          params.type,
          params.amount,
        );
      }
      return entry;
    };

    if (tx) {
      return run(tx);
    }
    return this.prisma.$transaction(run);
  }

  listForGroup(groupId: string, take = 50) {
    return this.prisma.ledgerEntry.findMany({
      where: { groupId },
      orderBy: { createdAt: "desc" },
      take,
    });
  }
}
