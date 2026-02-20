"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { INVOICE_STATUSES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, FileText, Search, Loader2, Trash2, RotateCcw } from "lucide-react";

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "partially_paid", label: "Partial" },
  { value: "cancelled", label: "Cancelled" },
];

export default function InvoicesPage() {
  const { activeCompanyId } = useCompanyStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const utils = trpc.useUtils();

  const { data: invoices, isLoading } = trpc.invoice.list.useQuery(
    {
      companyId: activeCompanyId!,
      search: search || undefined,
      status: statusFilter || undefined,
      showDeleted,
    },
    { enabled: !!activeCompanyId }
  );

  const restoreMutation = trpc.invoice.restore.useMutation({
    onSuccess: () => utils.invoice.list.invalidate(),
  });

  function getStatusBadge(status: string) {
    const s = INVOICE_STATUSES.find((st) => st.value === status);
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s?.color ?? "bg-gray-100 text-gray-700"}`}>
        {s?.label ?? status}
      </span>
    );
  }

  if (!activeCompanyId) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <div className="flex gap-2">
          <Button
            variant={showDeleted ? "default" : "outline"}
            size="sm"
            onClick={() => { setShowDeleted(!showDeleted); setStatusFilter(""); }}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {showDeleted ? "Viewing Trash" : "Trash"}
          </Button>
          {!showDeleted && (
            <Link href="/invoices/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Invoice
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search invoices..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {!showDeleted && (
          <div className="flex gap-1 flex-wrap">
            {STATUS_FILTERS.map((f) => (
              <Button
                key={f.value}
                variant={statusFilter === f.value ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(f.value)}
                className="text-xs"
              >
                {f.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && invoices?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h2 className="text-lg font-medium mb-1">
            {showDeleted
              ? "No deleted invoices"
              : search || statusFilter
                ? "No matching invoices"
                : "No invoices yet"}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {showDeleted
              ? "Deleted invoices will appear here."
              : search || statusFilter
                ? "Try adjusting your search or filters."
                : "Create your first invoice to get started."}
          </p>
          {!search && !statusFilter && !showDeleted && (
            <Link href="/invoices/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Invoice
              </Button>
            </Link>
          )}
        </div>
      )}

      {/* Invoice list - Desktop table */}
      {!isLoading && invoices && invoices.length > 0 && (
        <>
          {/* Desktop */}
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Invoice #</th>
                      <th className="px-4 py-3 font-medium">Customer</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Due Date</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium text-right">Amount</th>
                      <th className="px-4 py-3 font-medium text-right">
                        {showDeleted ? "Action" : "Balance"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/50 cursor-pointer">
                        <td className="px-4 py-3">
                          {showDeleted ? (
                            <span className="font-mono text-muted-foreground">{inv.invoiceNumber}</span>
                          ) : (
                            <Link href={`/invoices/${inv.id}`} className="font-mono text-primary hover:underline">
                              {inv.invoiceNumber}
                            </Link>
                          )}
                        </td>
                        <td className="px-4 py-3">{inv.customer.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(inv.invoiceDate)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(inv.dueDate)}</td>
                        <td className="px-4 py-3">{getStatusBadge(inv.status)}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(Number(inv.totalAmount))}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          {showDeleted ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => restoreMutation.mutate({ id: inv.id })}
                              disabled={restoreMutation.isPending}
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1" />
                              Restore
                            </Button>
                          ) : (
                            Number(inv.balanceDue) > 0 ? formatCurrency(Number(inv.balanceDue)) : "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {invoices.map((inv) => (
              <div key={inv.id}>
                {showDeleted ? (
                  <Card className="hover:bg-muted/50">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-mono text-sm font-medium text-muted-foreground">{inv.invoiceNumber}</p>
                          <p className="text-sm">{inv.customer.name}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => restoreMutation.mutate({ id: inv.id })}
                          disabled={restoreMutation.isPending}
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />
                          Restore
                        </Button>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatCurrency(Number(inv.totalAmount))}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Link href={`/invoices/${inv.id}`}>
                    <Card className="hover:bg-muted/50">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-mono text-sm font-medium text-primary">{inv.invoiceNumber}</p>
                            <p className="text-sm">{inv.customer.name}</p>
                          </div>
                          {getStatusBadge(inv.status)}
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{formatDate(inv.invoiceDate)}</span>
                          <span className="font-medium">{formatCurrency(Number(inv.totalAmount))}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
