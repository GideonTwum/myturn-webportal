"use client";

import Link from "next/link";
import { useEffect } from "react";
import { UserRole } from "@myturn/shared";
import { getStoredToken } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { EnvironmentBanner } from "@/components/EnvironmentBanner";
import { cn } from "@/lib/cn";

export default function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, ready, logout } = useAuth();

  useEffect(() => {
    if (!ready) return;
    const token = getStoredToken();
    if (!token || !user) {
      window.location.href = "/login";
      return;
    }
    if (user.role !== UserRole.USER) {
      if (user.role === UserRole.SUPER_ADMIN) {
        window.location.href = "/hq";
      } else if (user.role === UserRole.ADMIN) {
        window.location.href = "/admin";
      } else {
        window.location.href = "/login";
      }
    }
  }, [ready, user]);

  if (!ready || !user || user.role !== UserRole.USER) {
    return (
      <div
        className={cn(
          "flex min-h-screen flex-col items-center justify-center gap-3",
          "bg-surface-muted text-gray-500",
        )}
      >
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-brand-green border-t-transparent"
          aria-hidden
        />
        <span className="text-sm font-medium text-gray-600">Loading…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-muted">
      <EnvironmentBanner />
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <Link href="/member" className="font-bold text-brand-green">
            MyTurn
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-3 text-sm">
            <Link
              href="/join"
              className="font-medium text-gray-600 hover:text-gray-900"
            >
              Join group
            </Link>
            <button
              type="button"
              onClick={() => {
                logout();
                window.location.href = "/login";
              }}
              className="font-medium text-gray-600 hover:text-gray-900"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-6">{children}</main>
    </div>
  );
}
