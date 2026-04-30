import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Skeleton } from "./Skeleton";

export function StatCard({
  icon: Icon,
  label,
  value,
  loading,
  iconClassName,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  loading?: boolean;
  iconClassName?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 bg-white p-4 shadow-card transition-shadow duration-200 hover:shadow-card-md sm:p-6",
        className,
      )}
    >
      {loading ? (
        <Skeleton className="mb-3 h-8 w-8 rounded-md opacity-60" />
      ) : (
        <Icon
          className={cn(
            "h-8 w-8 shrink-0 text-brand-green",
            iconClassName,
          )}
          strokeWidth={1.75}
          aria-hidden
        />
      )}
      {loading ? (
        <>
          <Skeleton className="mt-3 h-9 w-20" />
          <Skeleton className="mt-2 h-4 w-36" />
        </>
      ) : (
        <>
          <p className="mt-3 text-3xl font-bold tracking-tight text-gray-900">
            {value}
          </p>
          <p className="mt-1 text-sm text-gray-500">{label}</p>
        </>
      )}
    </div>
  );
}
