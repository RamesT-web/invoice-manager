"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import {
  LayoutDashboard,
  FileText,
  Users,
  CreditCard,
  Landmark,
  Settings,
  ChevronDown,
  ShoppingCart,
  BarChart3,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  children?: { label: string; href: string }[];
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Sales",
    href: "/invoices",
    icon: FileText,
    children: [
      { label: "Invoices", href: "/invoices" },
      { label: "Quotes", href: "/quotes" },
      { label: "Credit Notes", href: "/credit-notes" },
    ],
  },
  {
    label: "Customers",
    href: "/customers",
    icon: Users,
  },
  {
    label: "Purchases",
    href: "/vendor-bills",
    icon: ShoppingCart,
    children: [
      { label: "Vendor Bills", href: "/vendor-bills" },
      { label: "Vendors", href: "/vendors" },
    ],
  },
  {
    label: "Payments",
    href: "/payments",
    icon: CreditCard,
  },
  {
    label: "Banking",
    href: "/banking",
    icon: Landmark,
    children: [
      { label: "Import Statement", href: "/banking/import" },
      { label: "Reconcile", href: "/banking/reconcile" },
    ],
  },
  {
    label: "Reports",
    href: "/reports",
    icon: BarChart3,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    children: [
      { label: "Company", href: "/settings" },
      { label: "Items & Services", href: "/settings/items" },
      { label: "Users & Access", href: "/settings/users" },
    ],
  },
];

function BackupIndicator() {
  const { activeCompanyId } = useCompanyStore();
  const { data: setting } = trpc.setting.get.useQuery(
    { companyId: activeCompanyId!, key: "last_backup_at" },
    { enabled: !!activeCompanyId }
  );

  if (!activeCompanyId) return null;

  const lastBackup = setting?.value ? new Date(setting.value as string) : null;
  const daysSinceBackup = lastBackup
    ? Math.floor((Date.now() - lastBackup.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isStale = daysSinceBackup === null || daysSinceBackup >= 7;

  const label = lastBackup
    ? daysSinceBackup === 0
      ? "Backed up today"
      : daysSinceBackup === 1
      ? "Backed up yesterday"
      : `Backup ${daysSinceBackup}d ago`
    : "No backup yet";

  return (
    <Link
      href="/reports"
      className={cn(
        "flex items-center gap-2 px-3 py-2 mx-2 rounded-md text-xs transition-colors",
        isStale
          ? "bg-orange-50 text-orange-700 hover:bg-orange-100"
          : "bg-green-50 text-green-700 hover:bg-green-100"
      )}
      title={lastBackup ? `Last backup: ${lastBackup.toLocaleString()}` : "No backup recorded"}
    >
      {isStale ? (
        <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0" />
      ) : (
        <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0" />
      )}
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 z-30">
      <div className="flex flex-col flex-grow border-r bg-white pt-5 pb-4 overflow-y-auto">
        {/* Logo */}
        <div className="flex items-center px-4 mb-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-semibold">Invoice Manager</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 space-y-1">
          {navItems.map((item) => (
            <NavItemComponent key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>

        {/* Backup status indicator */}
        <div className="mt-2 mb-1">
          <BackupIndicator />
        </div>
      </div>
    </aside>
  );
}

function NavItemComponent({ item, pathname }: { item: NavItem; pathname: string }) {
  const [expanded, setExpanded] = useState(
    item.children?.some((child) => pathname.startsWith(child.href)) ?? false
  );

  const isActive = item.children
    ? item.children.some((child) => pathname.startsWith(child.href))
    : pathname === item.href;

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            isActive
              ? "text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <item.icon className="h-4 w-4" />
          {item.label}
          <ChevronDown
            className={cn(
              "h-4 w-4 ml-auto transition-transform",
              expanded && "rotate-180"
            )}
          />
        </button>
        {expanded && (
          <div className="ml-7 mt-1 space-y-1">
            {item.children.map((child) => (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "flex items-center rounded-md px-3 py-1.5 text-sm transition-colors",
                  pathname.startsWith(child.href)
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <item.icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}
