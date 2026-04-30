"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ROLE_LABELS, UserRole } from "@myturn/shared";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/cn";

const inputClass = cn(
  "mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-gray-900",
  "outline-none ring-brand-green/20 focus:border-brand-green focus:ring-2",
);

export default function LoginPage() {
  const { login, user, ready, logout } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("hq@myturn.local");
  const [password, setPassword] = useState("ChangeMe123!");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!ready || !user) return;
    if (user.role === UserRole.SUPER_ADMIN) router.replace("/hq");
    else if (user.role === UserRole.ADMIN) router.replace("/admin");
    else if (user.role === UserRole.USER) router.replace("/member");
  }, [ready, user, router]);

  if (ready && user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-surface-muted text-gray-500">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-brand-green border-t-transparent"
          aria-hidden
        />
        <span className="text-sm font-medium text-gray-600">
          Redirecting…
        </span>
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login(email, password);
      const u = JSON.parse(localStorage.getItem("myturn_user") ?? "{}") as {
        role: UserRole;
      };
      if (u.role === UserRole.SUPER_ADMIN) router.replace("/hq");
      else if (u.role === UserRole.ADMIN) router.replace("/admin");
      else if (u.role === UserRole.USER) router.replace("/member");
      else {
        setError("Unsupported account type.");
        logout();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-card-md"
      >
        <div className="mb-2 inline-flex rounded-full bg-brand-green-soft px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-green-dark">
          MyTurn
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Sign in
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Web portal for {ROLE_LABELS[UserRole.SUPER_ADMIN]} and{" "}
          {ROLE_LABELS[UserRole.ADMIN]}.
        </p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          {error && (
            <p className="text-sm font-medium text-red-600" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="w-full min-h-[48px] rounded-xl bg-brand-green py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-brand-green-dark disabled:opacity-50"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600">
          <Link href="/join" className="font-semibold text-brand-green hover:underline">
            Join a group with an invite code
          </Link>
        </p>
        <p className="mt-3 text-center text-sm text-gray-600">
          <Link href="/member/sign-in" className="font-semibold text-brand-green hover:underline">
            Member sign-in (phone)
          </Link>
        </p>
        <p className="mt-3 text-center text-xs text-gray-500">
          Demo seed:{" "}
          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">
            hq@myturn.local
          </code>
        </p>
      </motion.div>
    </div>
  );
}
