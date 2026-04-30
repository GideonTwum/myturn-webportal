"use client";

import { useEffect } from "react";
import { UserRole } from "@myturn/shared";
import { AdminShell } from "@/components/PortalShell";
import { useAuth } from "@/lib/auth-context";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
    if (user.role === UserRole.SUPER_ADMIN) {
      window.location.href = "/hq";
      return;
    }
    if (user.role !== UserRole.ADMIN) {
      window.location.href = "/login";
    }
  }, [ready, user]);

  if (!ready || !user || user.role !== UserRole.ADMIN) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-surface-muted text-gray-500">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-brand-green border-t-transparent"
          aria-hidden
        />
        <span className="text-sm font-medium text-gray-600">Loading…</span>
      </div>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}
