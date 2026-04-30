"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, LogOut, PanelLeftClose, PanelLeft } from "lucide-react";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth-context";
import type { NavItem } from "./nav-config";

export function Sidebar({
  variant,
  items,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onMobileClose,
}: {
  variant: "admin" | "hq";
  items: NavItem[];
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const pathname = usePathname();
  const { logout, user } = useAuth();

  const sections = items.reduce<string[]>((acc, item) => {
    const s = item.section ?? "Menu";
    if (!acc.includes(s)) acc.push(s);
    return acc;
  }, []);

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-gray-200 bg-white shadow-card-md transition-all duration-200 lg:static lg:z-auto lg:shadow-none",
          collapsed ? "w-[4.5rem]" : "w-72",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-b border-gray-100 px-4",
            collapsed && "justify-center px-2",
          )}
        >
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-green">
                MyTurn
              </p>
              <p className="truncate text-sm font-bold text-gray-900">
                {variant === "admin" ? "Admin portal" : "MyTurn HQ"}
              </p>
              {user?.email && (
                <p className="truncate text-xs text-gray-500">{user.email}</p>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={onToggleCollapsed}
            className={cn(
              "hidden rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 lg:inline-flex",
              collapsed && "mx-auto",
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeft className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          {sections.map((section) => (
            <div key={section} className="mb-4 last:mb-0">
              {!collapsed && (
                <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  {section}
                </p>
              )}
              <ul className="space-y-1">
                {items
                  .filter((i) => (i.section ?? "Menu") === section)
                  .map(({ href, label, icon: Icon }) => {
                    const active =
                      href === "/admin" || href === "/hq"
                        ? pathname === href
                        : pathname === href ||
                          pathname.startsWith(`${href}/`);
                    return (
                      <li key={href}>
                        <Link
                          href={href}
                          onClick={onMobileClose}
                          className={cn(
                            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                            active
                              ? "border-l-4 border-brand-green bg-brand-green-soft text-brand-green-dark -ml-px pl-[11px]"
                              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                            collapsed && "justify-center px-2",
                            collapsed && active && "border-l-0 pl-2",
                          )}
                          title={collapsed ? label : undefined}
                        >
                          <Icon
                            className={cn(
                              "h-5 w-5 shrink-0",
                              active ? "text-brand-green" : "text-gray-400",
                            )}
                            strokeWidth={1.75}
                            aria-hidden
                          />
                          {!collapsed && <span>{label}</span>}
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-gray-100 p-3">
          <button
            type="button"
            onClick={() => {
              logout();
              window.location.href = "/login";
            }}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-red-50 hover:text-red-700",
              collapsed && "justify-center",
            )}
            title={collapsed ? "Sign out" : undefined}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile close pill */}
      {mobileOpen && (
        <button
          type="button"
          onClick={onMobileClose}
          className="fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-1 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-card-md lg:hidden"
          aria-label="Close menu"
        >
          <ChevronLeft className="h-4 w-4" />
          Close menu
        </button>
      )}
    </>
  );
}
