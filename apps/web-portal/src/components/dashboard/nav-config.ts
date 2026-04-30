import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CreditCard,
  FileText,
  LayoutDashboard,
  PieChart,
  Settings,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  section?: string;
};

export const adminNavItems: NavItem[] = [
  {
    href: "/admin",
    label: "Overview",
    icon: LayoutDashboard,
    section: "Admin",
  },
  { href: "/admin/groups", label: "Groups", icon: Building2, section: "Admin" },
  {
    href: "/admin/create-group",
    label: "Create group",
    icon: FileText,
    section: "Admin",
  },
  {
    href: "/admin/contributions",
    label: "Contributions",
    icon: CreditCard,
    section: "Admin",
  },
  { href: "/admin/payouts", label: "Payouts", icon: Wallet, section: "Admin" },
  { href: "/admin/earnings", label: "Earnings", icon: Users, section: "Admin" },
];

export const hqNavItems: NavItem[] = [
  {
    href: "/hq",
    label: "Overview",
    icon: LayoutDashboard,
    section: "MyTurn HQ",
  },
  {
    href: "/hq/financial-overview",
    label: "Financial Overview",
    icon: PieChart,
    section: "MyTurn HQ",
  },
  {
    href: "/hq/admin-requests",
    label: "Admin requests",
    icon: FileText,
    section: "MyTurn HQ",
  },
  {
    href: "/hq/admins",
    label: "Admins",
    icon: UserCog,
    section: "MyTurn HQ",
  },
  { href: "/hq/users", label: "Users", icon: Users, section: "MyTurn HQ" },
  {
    href: "/hq/groups",
    label: "Groups",
    icon: Building2,
    section: "MyTurn HQ",
  },
  {
    href: "/hq/transactions",
    label: "Payments (mock)",
    icon: CreditCard,
    section: "MyTurn HQ",
  },
  {
    href: "/hq/settings",
    label: "Settings",
    icon: Settings,
    section: "MyTurn HQ",
  },
];

const ADMIN_TITLES: Record<string, string> = {
  "/admin": "Admin dashboard",
  "/admin/groups": "Groups",
  "/admin/create-group": "Create group",
  "/admin/contributions": "Contributions",
  "/admin/payouts": "Payouts",
  "/admin/earnings": "Earnings",
};

const HQ_TITLES: Record<string, string> = {
  "/hq": "MyTurn HQ",
  "/hq/financial-overview": "Financial Overview",
  "/hq/admin-requests": "Admin requests",
  "/hq/admins": "Admins",
  "/hq/users": "Users",
  "/hq/groups": "Groups",
  "/hq/transactions": "Payments (mock)",
  "/hq/settings": "Platform settings",
};

export function pageTitleForPath(
  pathname: string,
  variant: "admin" | "hq",
): string {
  const map = variant === "admin" ? ADMIN_TITLES : HQ_TITLES;
  if (map[pathname]) return map[pathname];
  return variant === "admin" ? "Admin" : "MyTurn HQ";
}
