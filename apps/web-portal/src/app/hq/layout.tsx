"use client";

import { useEffect } from "react";
import { UserRole } from "@myturn/shared";
import { HqShell } from "@/components/PortalShell";
import { useAuth } from "@/lib/auth-context";

export default function HqLayout({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      window.location.href = "/login";
      return;
    }
    if (user.role === UserRole.USER) {
      window.location.href = "/member";
      return;
    }
    if (user.role !== UserRole.SUPER_ADMIN) {
      window.location.href = "/admin";
    }
  }, [ready, user]);

  if (!ready || !user || user.role !== UserRole.SUPER_ADMIN) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-surface-muted text-gray-500">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-brand-gold border-t-transparent"
          aria-hidden
        />
        <span className="text-sm font-medium text-gray-600">Loading…</span>
      </div>
    );
  }

  return <HqShell>{children}</HqShell>;
}
