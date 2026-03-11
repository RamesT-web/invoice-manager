"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Users,
  CreditCard,
  Settings,
} from "lucide-react";

const bottomNavItems = [
  { label: "Home", href: "/", icon: LayoutDashboard },
  { label: "Invoices", href: "/invoices", icon: FileText },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Payments", href: "/payments", icon: CreditCard },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t bg-white md:hidden safe-area-bottom shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
      {bottomNavItems.map((item) => {
        const isActive = item.href === "/"
          ? pathname === "/"
          : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-[10px] font-medium transition-colors",
              isActive
                ? "text-blue-600"
                : "text-gray-400"
            )}
          >
            <item.icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
