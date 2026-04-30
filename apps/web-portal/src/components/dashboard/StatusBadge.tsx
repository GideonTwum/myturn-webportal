import { cn } from "@/lib/cn";

export type StatusTone = "success" | "warning" | "error" | "info" | "neutral";

const toneStyles: Record<StatusTone, string> = {
  success:
    "bg-green-50 text-brand-green-dark ring-1 ring-green-200/80",
  warning:
    "bg-brand-gold-soft text-amber-900 ring-1 ring-amber-200/90",
  error: "bg-red-50 text-red-700 ring-1 ring-red-200/90",
  info: "bg-blue-50 text-blue-700 ring-1 ring-blue-200/80",
  neutral: "bg-gray-100 text-gray-700 ring-1 ring-gray-200",
};

export function statusToTone(status: string): StatusTone {
  const s = status.toUpperCase().replace(/\s/g, "_");
  if (
    [
      "ACTIVE",
      "PAID",
      "APPROVED",
      "SUCCESS",
    ].includes(s)
  ) {
    return "success";
  }
  if (["COMPLETED"].includes(s)) {
    return "info";
  }
  if (
    ["PENDING", "PROCESSING", "LATE", "DRAFT", "WARNING"].includes(s)
  ) {
    return "warning";
  }
  if (
    [
      "REJECTED",
      "FAILED",
      "CANCELLED",
      "DEFAULTED",
      "ERROR",
    ].includes(s)
  ) {
    return "error";
  }
  return "neutral";
}

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const tone = statusToTone(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
        toneStyles[tone],
        className,
      )}
    >
      {status.toLowerCase().replace(/_/g, " ")}
    </span>
  );
}
