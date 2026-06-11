/** Parse user-entered money amount (supports commas). */
export function parseMoneyAmount(s: string): number | null {
  const normalized = s.trim().replace(/,/g, "");
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}
