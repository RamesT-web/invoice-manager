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
  Paperclip,
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
      { label: "Rental Invoicing", href: "/rental-invoicing" },
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
    label: "Documents",
    href: "/documents",
    icon: Paperclip,
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
        "flex items-center gap-2 px-3 py-2 mx-3 rounded-md text-xs transition-colors",
        isStale
          ? "bg-orange-500/10 text-orange-300 hover:bg-orange-500/20"
          : "bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
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
    <aside className="hidden md:flex md:w-[220px] md:flex-col md:fixed md:inset-y-0 z-30">
      <div className="flex flex-col flex-grow bg-[#1B2A4A] overflow-y-auto scrollbar-thin">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 h-14 border-b border-white/10 shrink-0">
          <div className="h-7 w-7 rounded-lg bg-blue-500 flex items-center justify-center">
            <FileText className="h-4 w-4 text-white" />
          </div>
          <span className="text-[15px] font-semibold text-white tracking-tight">Invoice Manager</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {navItems.map((item) => (
            <NavItemComponent key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>

        {/* Backup status */}
        <div className="pb-3 shrink-0">
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
            "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
            isActive
              ? "text-white bg-white/10"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          )}
        >
          <item.icon className="h-[18px] w-[18px] shrink-0" />
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform duration-200 opacity-60",
              expanded && "rotate-180"
            )}
          />
        </button>
        {expanded && (
          <div className="ml-[30px] mt-0.5 space-y-0.5 border-l border-white/10 pl-2.5">
            {item.children.map((child) => (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "flex items-center rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                  pathname.startsWith(child.href)
                    ? "text-white bg-blue-500/20 font-medium"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
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
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
        isActive
          ? "text-white bg-white/10"
          : "text-slate-400 hover:text-white hover:bg-white/5"
      )}
    >
      <item.icon className="h-[18px] w-[18px] shrink-0" />
      {item.label}
    </Link>
  );
}
