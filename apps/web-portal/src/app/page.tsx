"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { UserRole } from "@myturn/shared";
import { useAuth } from "@/lib/auth-context";

export default function HomePage() {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role === UserRole.SUPER_ADMIN) {
      router.replace("/hq");
      return;
    }
    if (user.role === UserRole.ADMIN) {
      router.replace("/admin");
      return;
    }
    router.replace("/login");
  }, [ready, user, router]);

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
