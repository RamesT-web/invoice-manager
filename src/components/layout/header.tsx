"use client";

import { signOut, useSession } from "next-auth/react";
import { CompanySwitcher } from "./company-switcher";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, Bell } from "lucide-react";
import { useRef, useState, useEffect } from "react";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { data: session } = useSession();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const initials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "U";

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center border-b bg-white px-4 sm:px-6 print:hidden">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden mr-2 h-9 w-9"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Company Switcher */}
      <div className="flex-1 min-w-0">
        <CompanySwitcher />
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-1 ml-4">
        {/* Notifications placeholder */}
        <button className="flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:bg-gray-100 transition-colors">
          <Bell className="h-[18px] w-[18px]" />
        </button>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-gray-100 transition-colors"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs font-semibold bg-blue-600 text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-[120px] truncate">
              {session?.user?.name}
            </span>
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-56 rounded-lg border bg-white p-1.5 shadow-lg ring-1 ring-black/5">
              <div className="px-3 py-2">
                <p className="text-sm font-medium text-gray-900">{session?.user?.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{session?.user?.email}</p>
              </div>
              <div className="h-px bg-gray-100 my-1" />
              <button
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
