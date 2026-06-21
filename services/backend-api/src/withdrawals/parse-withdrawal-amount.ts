import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

const INVALID_AMOUNT_MESSAGE = "Please enter a valid withdrawal amount.";

/** Parse user-entered withdrawal amount (supports commas). Never throws raw Decimal errors. */
export function parseWithdrawalAmount(raw: string): Prisma.Decimal {
  const normalized = raw.replace(/,/g, "").trim();
  if (!normalized) {
    throw new BadRequestException(INVALID_AMOUNT_MESSAGE);
  }

  let amount: Prisma.Decimal;
  try {
    amount = new Prisma.Decimal(normalized);
  } catch {
    throw new BadRequestException(INVALID_AMOUNT_MESSAGE);
  }

  if (!amount.isFinite() || amount.lte(0)) {
    throw new BadRequestException(INVALID_AMOUNT_MESSAGE);
  }

  return amount;
}
