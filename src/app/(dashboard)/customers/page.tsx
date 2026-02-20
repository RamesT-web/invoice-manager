"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Pencil, Trash2, Loader2, RotateCcw, BookOpen } from "lucide-react";
import Link from "next/link";

export default function CustomersPage() {
  const { activeCompanyId } = useCompanyStore();
  const [search, setSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const utils = trpc.useUtils();

  const { data: customers, isLoading } = trpc.customer.list.useQuery(
    { companyId: activeCompanyId!, search: search || undefined, showDeleted },
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Customers</h1>
        <div className="flex gap-2">
          <Button
            variant={showDeleted ? "default" : "outline"}
            size="sm"
            onClick={() => setShowDeleted(!showDeleted)}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {showDeleted ? "Viewing Trash" : "Trash"}
          </Button>
          {!showDeleted && (
            <Link href="/customers/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Customer
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search customers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !customers?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          {showDeleted
            ? "No deleted customers."
            : search
              ? "No customers match your search."
              : "No customers yet. Add your first customer."}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium hidden sm:table-cell">GSTIN</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Contact</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">City</th>
                <th className="text-right p-3 font-medium w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3">
                    {showDeleted ? (
                      <span className="font-medium text-muted-foreground">{c.name}</span>
                    ) : (
                      <Link href={`/customers/${c.id}`} className="font-medium text-primary hover:underline">
                        {c.name}
                      </Link>
                    )}
                    <div className="text-xs text-muted-foreground sm:hidden">{c.gstin || "—"}</div>
                  </td>
                  <td className="p-3 hidden sm:table-cell text-muted-foreground font-mono text-xs">
                    {c.gstin || "—"}
                  </td>
                  <td className="p-3 hidden md:table-cell text-muted-foreground">
                    {c.contactName || "—"}
                  </td>
                  <td className="p-3 hidden md:table-cell text-muted-foreground">
                    {c.billingCity || "—"}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      {showDeleted ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => restoreMutation.mutate({ id: c.id })}
                          disabled={restoreMutation.isPending}
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />
                          Restore
                        </Button>
                      ) : (
                        <>
                          <Link href={`/customers/${c.id}/ledger`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Ledger">
                              <BookOpen className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                          <Link href={`/customers/${c.id}`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
