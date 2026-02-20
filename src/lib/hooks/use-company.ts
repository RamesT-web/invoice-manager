"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CompanyState {
  activeCompanyId: string | null;
  setActiveCompanyId: (id: string) => void;
}

export const useCompanyStore = create<CompanyState>()(
  persist(
    (set) => ({
      activeCompanyId: null,
      setActiveCompanyId: (id) => set({ activeCompanyId: id }),
    }),
    { name: "active-company" }
  )
);
