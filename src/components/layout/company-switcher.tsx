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

  // Only one company — just show the name, no dropdown
  if (companies.length === 1) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium truncate max-w-[160px]">
          {companies[0].name}
        </span>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent transition-colors w-full"
      >
        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="truncate max-w-[160px]">
          {activeCompany?.name ?? "Select Company"}
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-auto" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[200px] rounded-md border bg-popover p-1 shadow-md z-50">
          {companies.map((company) => (
            <button
              key={company.id}
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors",
                company.id === activeCompanyId && "bg-accent"
              )}
              onClick={() => {
                setActiveCompanyId(company.id);
                setOpen(false);
              }}
            >
              <Check
                className={cn(
                  "h-4 w-4",
                  company.id === activeCompanyId ? "opacity-100" : "opacity-0"
                )}
              />
              <span className="truncate">{company.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
