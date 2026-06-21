import { BadRequestException } from "@nestjs/common";
import { LedgerAccountType, Prisma } from "@prisma/client";

export const HQ_LEDGER_EXPLORABLE_ACCOUNT_TYPES: LedgerAccountType[] = [
  LedgerAccountType.SYSTEM_EXTERNAL,
  LedgerAccountType.PLATFORM_FLOAT,
  LedgerAccountType.GROUP_POOL,
  LedgerAccountType.MEMBER_WALLET_AVAILABLE,
  LedgerAccountType.MEMBER_WALLET_RESERVED,
  LedgerAccountType.MEMBER_DEPOSIT_ESCROW,
  LedgerAccountType.MYTURN_REVENUE,
  LedgerAccountType.WITHDRAWAL_CLEARING,
];

const SENSITIVE_METADATA_KEY = /secret|token|password|apikey|api_key|authorization|subscription|credential/i;

export function parseExplorerLimit(raw?: string): number {
  const n = parseInt(raw ?? "50", 10);
  if (!Number.isFinite(n) || n < 1) return 50;
  return Math.min(n, 200);
}

export function decimalToMinor(amount: Prisma.Decimal): string {
  return BigInt(amount.mul(100).toFixed(0)).toString();
}

export function decimalToGhs(amount: Prisma.Decimal): string {
  return new Prisma.Decimal(amount.toString()).toFixed(2);
}

export function parseOptionalDecimal(
  raw: string | undefined,
  label: string,
): Prisma.Decimal | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  try {
    const d = new Prisma.Decimal(raw.trim());
    if (!d.isFinite()) throw new Error("invalid");
    return d;
  } catch {
    throw new BadRequestException(`Invalid ${label}`);
  }
}

export function parseAccountType(
  raw: string | undefined,
): LedgerAccountType | undefined {
  if (!raw?.trim()) return undefined;
  const value = raw.trim() as LedgerAccountType;
  if (!HQ_LEDGER_EXPLORABLE_ACCOUNT_TYPES.includes(value)) {
    throw new BadRequestException(`Unsupported accountType: ${raw}`);
  }
  return value;
}

export function sanitizeLedgerMetadata(meta: unknown): unknown {
  if (meta == null) return meta;
  if (Array.isArray(meta)) {
    return meta.map((item) => sanitizeLedgerMetadata(item));
  }
  if (typeof meta !== "object") return meta;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta as Record<string, unknown>)) {
    if (SENSITIVE_METADATA_KEY.test(key)) {
      out[key] = "[REDACTED]";
      continue;
    }
    if (value && typeof value === "object") {
      out[key] = sanitizeLedgerMetadata(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function encodeLedgerCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString("base64url");
}

export function decodeLedgerCursor(raw: string): { createdAt: Date; id: string } {
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const sep = decoded.lastIndexOf("|");
    if (sep <= 0) throw new Error("bad cursor");
    const createdAt = new Date(decoded.slice(0, sep));
    const id = decoded.slice(sep + 1);
    if (!id || Number.isNaN(createdAt.getTime())) throw new Error("bad cursor");
    return { createdAt, id };
  } catch {
    throw new BadRequestException("Invalid cursor");
  }
}
