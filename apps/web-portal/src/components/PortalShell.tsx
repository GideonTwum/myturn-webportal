"use client";

import { DashboardShell } from "./dashboard/DashboardShell";

export function AdminShell({ children }: { children: React.ReactNode }) {
  return <DashboardShell variant="admin">{children}</DashboardShell>;
}

export function HqShell({ children }: { children: React.ReactNode }) {
  return <DashboardShell variant="hq">{children}</DashboardShell>;
}
