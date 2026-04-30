import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-gray-200", className)}
      aria-hidden
    />
  );
}

export function SkeletonStatCard() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-card">
      <Skeleton className="mb-3 h-8 w-8 rounded-md" />
      <Skeleton className="mb-2 h-8 w-24" />
      <Skeleton className="h-4 w-32" />
    </div>
  );
}
