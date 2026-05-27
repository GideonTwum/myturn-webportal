"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Member phone sign-in is mobile-only; send stray links to admin login. */
export default function MemberSignInPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/login");
  }, [router]);
  return null;
}
