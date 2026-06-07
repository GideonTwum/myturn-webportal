import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { LedgerAccountType } from "@prisma/client";

export type PostingLine = {
  accountId: string;
  delta: Prisma.Decimal;
};

export type PostJournalInput = {
  idempotencyKey: string;
  referenceType: string;
  referenceId: string;
  description?: string;
  metadata?: Prisma.InputJsonValue;
  lines: PostingLine[];
};

@Injectable()
export class LedgerPostingService {
  private readonly logger = new Logger(LedgerPostingService.name);

  constructor(private prisma: PrismaService) {}

  /** Post a balanced journal inside an existing transaction. */
  async postJournalInTx(tx: Prisma.TransactionClient, input: PostJournalInput) {
    this.assertBalanced(input.lines);

    const existing = await tx.ledgerTransaction.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { lines: true },
    });
    if (existing) {
      return { transaction: existing, duplicate: true as const };
    }

    for (const line of input.lines) {
      if (line.delta.isZero()) {
        throw new BadRequestException("Ledger line delta cannot be zero");
      }
      await this.assertNonNegativeAfterDelta(tx, line.accountId, line.delta);
    }

    const transaction = await tx.ledgerTransaction.create({
      data: {
        idempotencyKey: input.idempotencyKey,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        description: input.description,
        metadata: input.metadata,
      },
    });

    const createdLines = [];
    for (const line of input.lines) {
      const account = await tx.ledgerAccount.findUniqueOrThrow({
        where: { id: line.accountId },
      });
      const nextBalance = new Prisma.Decimal(account.balance.toString()).add(line.delta);
      await tx.ledgerAccount.update({
        where: { id: account.id },
        data: { balance: nextBalance },
      });
      const ledgerLine = await tx.ledgerLine.create({
        data: {
          transactionId: transaction.id,
          accountId: account.id,
          delta: line.delta,
          balanceAfter: nextBalance,
        },
      });
      createdLines.push(ledgerLine);
    }

    this.logger.log(
      JSON.stringify({
        domain: "ledger",
        event: "journal.posted",
        idempotencyKey: input.idempotencyKey,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        lineCount: createdLines.length,
      }),
    );

    return {
      transaction: { ...transaction, lines: createdLines },
      duplicate: false as const,
    };
  }

  async postJournal(input: PostJournalInput) {
    return this.prisma.$transaction((tx) => this.postJournalInTx(tx, input));
  }

  /** Convenience: transfer between two accounts (from loses, to gains). */
  async postTransferInTx(
    tx: Prisma.TransactionClient,
    params: {
      idempotencyKey: string;
      referenceType: string;
      referenceId: string;
      description?: string;
      metadata?: Prisma.InputJsonValue;
      fromAccountId: string;
      toAccountId: string;
      amount: Prisma.Decimal;
    },
  ) {
    if (params.amount.lte(0)) {
      throw new BadRequestException("Transfer amount must be positive");
    }
    if (params.fromAccountId === params.toAccountId) {
      throw new BadRequestException("Cannot transfer to the same account");
    }
    const neg = new Prisma.Decimal(params.amount.toString()).mul(-1);
    return this.postJournalInTx(tx, {
      idempotencyKey: params.idempotencyKey,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      description: params.description,
      metadata: params.metadata,
      lines: [
        { accountId: params.fromAccountId, delta: neg },
        { accountId: params.toAccountId, delta: params.amount },
      ],
    });
  }

  private assertBalanced(lines: PostingLine[]) {
    if (lines.length < 2) {
      throw new BadRequestException("Journal requires at least two lines");
    }
    const sum = lines.reduce(
      (acc, l) => acc.add(l.delta),
      new Prisma.Decimal(0),
    );
    if (!sum.isZero()) {
      throw new ConflictException(
        `Unbalanced journal: net delta ${sum.toString()} (must be 0)`,
      );
    }
  }

  private async assertNonNegativeAfterDelta(
    tx: Prisma.TransactionClient,
    accountId: string,
    delta: Prisma.Decimal,
  ) {
    const account = await tx.ledgerAccount.findUniqueOrThrow({
      where: { id: accountId },
    });
    if (account.accountType === LedgerAccountType.SYSTEM_EXTERNAL) {
      return;
    }
    const next = new Prisma.Decimal(account.balance.toString()).add(delta);
    if (next.lt(0)) {
      throw new BadRequestException(
        `Insufficient balance on account ${account.accountKey} (would be ${next.toString()})`,
      );
    }
  }
}
