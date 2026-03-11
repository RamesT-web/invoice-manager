"use client";

import { useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { INVOICE_STATUSES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, FileText, Search, Loader2, Trash2, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 50;

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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.invoice.list.useQuery(
    {
      companyId: activeCompanyId!,
      search: debouncedSearch || undefined,
      status: statusFilter || undefined,
      showDeleted,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page,
      pageSize: PAGE_SIZE,
    },
    { enabled: !!activeCompanyId, placeholderData: keepPreviousData }
  );
  const invoices = data?.invoices;
  const totalPages = data?.totalPages ?? 1;
  const totalCount = data?.totalCount ?? 0;

  const restoreMutation = trpc.invoice.restore.useMutation({
    onSuccess: () => utils.invoice.list.invalidate(),
  });

  function getStatusBadge(status: string) {
    const s = INVOICE_STATUSES.find((st) => st.value === status);
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${s?.color ?? "bg-gray-100 text-gray-700"}`}>
        {s?.label ?? status}
      </span>
    );
  }

  if (!activeCompanyId) return null;

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Invoices</h1>
        <div className="flex items-center gap-2">
          <Button
            variant={showDeleted ? "default" : "outline"}
            size="sm"
            className="h-9"
            onClick={() => { setShowDeleted(!showDeleted); setStatusFilter(""); setPage(1); }}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            {showDeleted ? "Viewing Trash" : "Trash"}
          </Button>
          {!showDeleted && (
            <Link href="/invoices/new">
              <Button size="sm" className="h-9 bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-1.5" />
                New Invoice
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-white rounded-lg border p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search invoices..."
              className="pl-9 h-9 bg-gray-50 border-gray-200"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="flex gap-2 items-center">
            <Input
              type="date"
              className="w-[140px] h-9 bg-gray-50 border-gray-200 text-sm"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            />
            <span className="text-xs text-gray-400 font-medium">to</span>
            <Input
              type="date"
              className="w-[140px] h-9 bg-gray-50 border-gray-200 text-sm"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            />
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setDateFrom(""); setDateTo(""); setPage(1); }}>
                Clear
              </Button>
            )}
          </div>
        </div>
        {!showDeleted && (
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => { setStatusFilter(f.value); setPage(1); }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === f.value
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && invoices?.length === 0 && (
        <div className="bg-white rounded-lg border">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
              <FileText className="h-8 w-8 text-gray-300" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">
              {showDeleted
                ? "No deleted invoices"
                : search || statusFilter
                  ? "No matching invoices"
                  : "No invoices yet"}
            </h2>
            <p className="text-sm text-gray-500 mb-4 max-w-sm">
              {showDeleted
                ? "Deleted invoices will appear here."
                : search || statusFilter
                  ? "Try adjusting your search or filters."
                  : "Create your first invoice to get started."}
            </p>
            {!search && !statusFilter && !showDeleted && (
              <Link href="/invoices/new">
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Create Invoice
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Invoice list */}
      {!isLoading && invoices && invoices.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-lg border overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-[140px]">Invoice #</th>
                  <th>Customer</th>
                  <th className="w-[110px]">Date</th>
                  <th className="w-[110px]">Due Date</th>
                  <th className="w-[100px]">Status</th>
                  <th className="w-[130px] text-right">Amount</th>
                  <th className="w-[130px] text-right">
                    {showDeleted ? "Action" : "Balance"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="cursor-pointer">
                    <td>
                      {showDeleted ? (
                        <span className="font-mono text-sm text-gray-400">{inv.invoiceNumber}</span>
                      ) : (
                        <Link href={`/invoices/${inv.id}`} className="font-mono text-sm text-blue-600 hover:text-blue-700 font-medium">
                          {inv.invoiceNumber}
                        </Link>
                      )}
                    </td>
                    <td className="text-gray-900 font-medium">{inv.customer.name}</td>
                    <td className="text-gray-500">{formatDate(inv.invoiceDate)}</td>
                    <td className="text-gray-500">{formatDate(inv.dueDate)}</td>
                    <td>{getStatusBadge(inv.status)}</td>
                    <td className="text-right font-semibold text-gray-900 tabular-nums">{formatCurrency(Number(inv.totalAmount))}</td>
                    <td className="text-right tabular-nums">
                      {showDeleted ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => restoreMutation.mutate({ id: inv.id })}
                          disabled={restoreMutation.isPending}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Restore
                        </Button>
                      ) : (
                        <span className={Number(inv.balanceDue) > 0 ? "font-medium text-gray-900" : "text-gray-400"}>
                          {Number(inv.balanceDue) > 0 ? formatCurrency(Number(inv.balanceDue)) : "\u2014"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {invoices.map((inv) => (
              <div key={inv.id}>
                {showDeleted ? (
                  <div className="bg-white rounded-lg border p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-mono text-sm font-medium text-gray-400">{inv.invoiceNumber}</p>
                        <p className="text-sm text-gray-700">{inv.customer.name}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => restoreMutation.mutate({ id: inv.id })}
                        disabled={restoreMutation.isPending}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Restore
                      </Button>
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatCurrency(Number(inv.totalAmount))}
                    </div>
                  </div>
                ) : (
                  <Link href={`/invoices/${inv.id}`}>
                    <div className="bg-white rounded-lg border p-4 hover:border-blue-200 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="min-w-0">
                          <p className="font-mono text-sm font-medium text-blue-600">{inv.invoiceNumber}</p>
                          <p className="text-sm text-gray-700 truncate">{inv.customer.name}</p>
                        </div>
                        {getStatusBadge(inv.status)}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">{formatDate(inv.invoiceDate)}</span>
                        <span className="font-semibold text-gray-900">{formatCurrency(Number(inv.totalAmount))}</span>
                      </div>
                    </div>
                  </Link>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * PAGE_SIZE + 1}\u2013{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline ml-1">Previous</span>
                </Button>
                <span className="text-sm text-gray-500 tabular-nums">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <span className="hidden sm:inline mr-1">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
