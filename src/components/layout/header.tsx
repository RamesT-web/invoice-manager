"use client";

import { signOut, useSession } from "next-auth/react";
import { CompanySwitcher } from "./company-switcher";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, Menu } from "lucide-react";
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
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b bg-white px-4 sm:px-6">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Company Switcher */}
      <div className="flex-1">
        <CompanySwitcher />
      </div>

      {/* User menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className="flex items-center gap-2 rounded-md p-1.5 hover:bg-accent transition-colors"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden sm:block text-sm font-medium">
            {session?.user?.name}
          </span>
        </button>

        {userMenuOpen && (
          <div className="absolute right-0 top-full mt-1 w-48 rounded-md border bg-popover p-1 shadow-md">
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              {session?.user?.email}
            </div>
            <div className="h-px bg-border my-1" />
            <button
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent transition-colors"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
