import { createHash } from "node:crypto";
import { BadRequestException } from "@nestjs/common";

/** Normalize Ghana Card ID (GHA-XXXXXXXXX-X). */
export function normalizeGhanaCardNumber(raw: string): string {
  const compact = raw.replace(/\s+/g, "").toUpperCase();
  const match = compact.match(/^GHA-?(\d{9})-?(\d)$/i);
  if (!match) {
    throw new BadRequestException(
      "Enter a valid Ghana Card number (format GHA-XXXXXXXXX-X)",
    );
  }
  return `GHA-${match[1]}-${match[2]}`;
}

export function hashGhanaCardNumber(normalized: string): string {
  return createHash("sha256").update(normalized).digest("hex");
}

export function maskGhanaCardLast4(normalized: string): string {
  const digits = normalized.replace(/\D/g, "");
  return digits.slice(-4);
}

export function sanitizeAssetKey(key?: string): string | undefined {
  if (!key?.trim()) return undefined;
  const k = key.trim();
  if (k.length > 200 || /[<>]/.test(k)) {
    throw new BadRequestException("Invalid asset reference");
  }
  return k;
}
