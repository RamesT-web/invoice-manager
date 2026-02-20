"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-60 md:hidden">
            <Sidebar />
          </div>
        </>
      )}

      {/* Main content area */}
      <div className="md:pl-60 flex flex-col min-h-screen">
        <Header onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)} />
        <main className="flex-1 p-4 sm:p-6 pb-20 md:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <MobileNav />
    </div>
  );
}
