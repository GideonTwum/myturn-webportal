export function formatGhs(amount: string | number): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (!Number.isFinite(n)) return "GHS —";
  return `GHS ${n.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function healthScoreFromProgress(paid: number, expected: number): number {
  if (expected <= 0) return 100;
  return Math.min(100, Math.round((paid / expected) * 100));
}
