"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Pencil, Trash2, Loader2, RotateCcw, BookOpen, Users } from "lucide-react";
import Link from "next/link";

export default function CustomersPage() {
  const { activeCompanyId } = useCompanyStore();
  const [search, setSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const debouncedSearch = useDebounce(search);
  const utils = trpc.useUtils();

  const { data: customers, isLoading } = trpc.customer.list.useQuery(
    { companyId: activeCompanyId!, search: debouncedSearch || undefined, showDeleted },
    { enabled: !!activeCompanyId }
  );

  const deleteMutation = trpc.customer.delete.useMutation({
    onSuccess: () => utils.customer.list.invalidate(),
  });
  const restoreMutation = trpc.customer.restore.useMutation({
    onSuccess: () => utils.customer.list.invalidate(),
  });

  if (!activeCompanyId) return null;

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Customers</h1>
        <div className="flex items-center gap-2">
          <Button
            variant={showDeleted ? "default" : "outline"}
            size="sm"
            className="h-9"
            onClick={() => setShowDeleted(!showDeleted)}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            {showDeleted ? "Viewing Trash" : "Trash"}
          </Button>
          {!showDeleted && (
            <Link href="/customers/new">
              <Button size="sm" className="h-9 bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-1.5" />
                Add Customer
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-gray-50 border-gray-200"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : !customers?.length ? (
        <div className="bg-white rounded-lg border">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-gray-300" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">
              {showDeleted
                ? "No deleted customers"
                : search
                  ? "No customers match your search"
                  : "No customers yet"}
            </h2>
            <p className="text-sm text-gray-500">
              {showDeleted
                ? "Deleted customers will appear here."
                : search
                  ? "Try adjusting your search."
                  : "Add your first customer to get started."}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="hidden sm:table-cell">GSTIN</th>
                <th className="hidden md:table-cell">Contact</th>
                <th className="hidden md:table-cell">City</th>
                <th className="text-right w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const addressParts = [
                  c.billingAddressLine1,
                  c.billingAddressLine2,
                  c.billingCity,
                  c.billingStateName || c.billingState,
                  c.billingPincode,
                ].filter(Boolean);
                const address = addressParts.join(", ");
                return (
                <tr key={c.id}>
                  <td>
                    {showDeleted ? (
                      <span className="font-medium text-gray-400">{c.name}</span>
                    ) : (
                      <Link href={`/customers/${c.id}`} className="font-medium text-blue-600 hover:text-blue-700">
                        {c.name}
                      </Link>
                    )}
                    {address && (
                      <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[250px]">{address}</div>
                    )}
                    <div className="text-xs text-gray-400 sm:hidden font-mono">{c.gstin || "\u2014"}</div>
                  </td>
                  <td className="hidden sm:table-cell text-gray-500 font-mono text-xs">
                    {c.gstin || "\u2014"}
                  </td>
                  <td className="hidden md:table-cell text-gray-500">
                    {c.contactName || "\u2014"}
                  </td>
                  <td className="hidden md:table-cell text-gray-500">
                    {c.billingCity || "\u2014"}
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-0.5">
                      {showDeleted ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => restoreMutation.mutate({ id: c.id })}
                          disabled={restoreMutation.isPending}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Restore
                        </Button>
                      ) : (
                        <>
                          <Link href={`/customers/${c.id}/ledger`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-blue-600" title="Ledger">
                              <BookOpen className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                          <Link href={`/customers/${c.id}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-blue-600">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-400 hover:text-red-500"
                            onClick={() => {
                              if (confirm("Move this customer to trash?")) {
                                deleteMutation.mutate({ id: c.id });
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
