"use client";

import { Menu } from "lucide-react";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth-context";
import { pageTitleForPath } from "./nav-config";

function initials(email: string): string {
  const local = email.split("@")[0] ?? "?";
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  }
  return local.slice(0, 2).toUpperCase();
}

export function Topbar({
  variant,
  pathname,
  onMenuClick,
}: {
  variant: "admin" | "hq";
  pathname: string;
  onMenuClick: () => void;
}) {
  const { user } = useAuth();
  const title = pageTitleForPath(pathname, variant);

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur-md">
      <div className="flex h-14 sm:h-16 items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex rounded-xl p-2 text-gray-700 hover:bg-gray-100 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="truncate text-lg font-bold text-gray-900 sm:text-xl">
            {title}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span
            className={cn(
              "hidden rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide sm:inline-flex",
              variant === "hq"
                ? "bg-brand-gold-soft text-amber-900 ring-1 ring-brand-gold/40"
                : "bg-brand-green-soft text-brand-green-dark ring-1 ring-brand-green/35",
            )}
          >
            {variant === "hq" ? "MyTurn HQ" : "Admin"}
          </span>
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-green to-brand-green-dark text-xs font-bold text-white shadow-sm ring-2 ring-white"
            title={user?.email ?? ""}
            aria-hidden
          >
            {user?.email ? initials(user.email) : "?"}
          </div>
        </div>
      </div>
    </header>
  );
}
