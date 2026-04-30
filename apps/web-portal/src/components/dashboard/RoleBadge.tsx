import { ROLE_LABELS, UserRole } from "@myturn/shared";
import { cn } from "@/lib/cn";

const styles: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]:
    "bg-brand-gold-soft text-amber-900 ring-amber-200/80",
  [UserRole.ADMIN]: "bg-brand-green-soft text-brand-green-dark ring-green-200/80",
  [UserRole.USER]: "bg-gray-100 text-gray-700 ring-gray-200",
};

export function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1",
        styles[role],
      )}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}
