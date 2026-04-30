"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { adminNavItems, hqNavItems } from "./nav-config";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function DashboardShell({
  variant,
  children,
}: {
  variant: "admin" | "hq";
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? (variant === "admin" ? "/admin" : "/hq");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const nav = variant === "admin" ? adminNavItems : hqNavItems;

  return (
    <div className="flex min-h-screen bg-surface-muted">
      <Sidebar
        variant={variant}
        items={nav}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] lg:hidden"
          aria-label="Close menu overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:ml-0">
        <Topbar
          variant={variant}
          pathname={pathname}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
