"use client";

import { useCompanyStore } from "@/lib/hooks/use-company";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function CompanySwitcher() {
  const { activeCompanyId, setActiveCompanyId } = useCompanyStore();
  const { data: companies } = trpc.company.list.useQuery();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Set default company on first load
  useEffect(() => {
    if (companies && companies.length > 0 && !activeCompanyId) {
      const defaultCompany = companies.find((c) => c.isDefault) ?? companies[0];
      setActiveCompanyId(defaultCompany.id);
    }
  }, [companies, activeCompanyId, setActiveCompanyId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeCompany = companies?.find((c) => c.id === activeCompanyId);

  if (!companies || companies.length === 0) return null;

  // Only one company — just show the name
  if (companies.length === 1) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
          <Building2 className="h-4 w-4 text-blue-600" />
        </div>
        <span className="text-sm font-semibold text-gray-900 truncate max-w-[200px]">
          {companies[0].name}
        </span>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm hover:bg-gray-100 transition-colors max-w-[280px]"
      >
        <Building2 className="h-4 w-4 text-gray-500 shrink-0" />
        <span className="truncate font-medium text-gray-800">
          {activeCompany?.name ?? "Select Company"}
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-gray-400 shrink-0 ml-auto" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-full min-w-[220px] rounded-lg border bg-white p-1 shadow-lg ring-1 ring-black/5 z-50">
          {companies.map((company) => (
            <button
              key={company.id}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                company.id === activeCompanyId
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:bg-gray-50"
              )}
              onClick={() => {
                setActiveCompanyId(company.id);
                setOpen(false);
              }}
            >
              <Check
                className={cn(
                  "h-4 w-4 shrink-0",
                  company.id === activeCompanyId ? "text-blue-600" : "opacity-0"
                )}
              />
              <span className="truncate font-medium">{company.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
