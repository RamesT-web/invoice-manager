"use client";

import { useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VENDOR_BILL_STATUSES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Search, Loader2, Trash2, RotateCcw, ChevronLeft, ChevronRight, ShoppingCart } from "lucide-react";
import Link from "next/link";

const PAGE_SIZE = 50;

export default function VendorBillsPage() {
  const { activeCompanyId } = useCompanyStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.vendorBill.list.useQuery(
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
  const bills = data?.bills;
  const totalPages = data?.totalPages ?? 1;
  const totalCount = data?.totalCount ?? 0;

  const restoreMutation = trpc.vendorBill.restore.useMutation({
    onSuccess: () => utils.vendorBill.list.invalidate(),
  });

  if (!activeCompanyId) return null;

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Vendor Bills</h1>
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
            <Link href="/vendor-bills/new">
              <Button size="sm" className="h-9 bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-1.5" />
                New Bill
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-white rounded-lg border p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Search bills..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9 h-9 bg-gray-50 border-gray-200" />
          </div>
          {!showDeleted && (
            <select
              className="flex h-9 rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">All statuses</option>
              {VENDOR_BILL_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          )}
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

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : !bills?.length ? (
        <div className="bg-white rounded-lg border">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
              <ShoppingCart className="h-8 w-8 text-gray-300" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">
              {showDeleted ? "No deleted vendor bills" : "No vendor bills yet"}
            </h2>
            <p className="text-sm text-gray-500">
              {showDeleted ? "Deleted vendor bills will appear here." : "Record your first vendor bill to get started."}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Bill #</th>
                  <th>Vendor</th>
                  <th className="hidden sm:table-cell">Date</th>
                  <th className="hidden md:table-cell">Due Date</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">{showDeleted ? "Action" : "Balance"}</th>
                  {!showDeleted && <th className="text-center">Status</th>}
                </tr>
              </thead>
              <tbody>
                {bills.map((bill) => {
                  const status = VENDOR_BILL_STATUSES.find((s) => s.value === bill.status);
                  return (
                    <tr key={bill.id} className="cursor-pointer">
                      <td>
                        {showDeleted ? (
                          <span className="font-mono text-sm text-gray-400">{bill.billNumber}</span>
                        ) : (
                          <Link href={`/vendor-bills/${bill.id}`} className="font-mono text-sm text-blue-600 hover:text-blue-700 font-medium">
                            {bill.billNumber}
                          </Link>
                        )}
                      </td>
                      <td className="text-gray-900 font-medium">{bill.vendor.name}</td>
                      <td className="hidden sm:table-cell text-gray-500">{formatDate(bill.billDate)}</td>
                      <td className="hidden md:table-cell text-gray-500">{formatDate(bill.dueDate)}</td>
                      <td className="text-right font-semibold text-gray-900 tabular-nums">{formatCurrency(Number(bill.totalAmount))}</td>
                      <td className="text-right tabular-nums">
                        {showDeleted ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => restoreMutation.mutate({ id: bill.id })}
                            disabled={restoreMutation.isPending}
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Restore
                          </Button>
                        ) : (
                          <span className={Number(bill.balanceDue) > 0 ? "font-medium text-gray-900" : "text-gray-400"}>
                            {Number(bill.balanceDue) > 0 ? formatCurrency(Number(bill.balanceDue)) : "\u2014"}
                          </span>
                        )}
                      </td>
                      {!showDeleted && (
                        <td className="text-center">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${status?.color ?? "bg-gray-100 text-gray-700"}`}>
                            {status?.label ?? bill.status}
                          </span>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * PAGE_SIZE + 1}\u2013{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline ml-1">Previous</span>
                </Button>
                <span className="text-sm text-gray-500 tabular-nums">{page} / {totalPages}</span>
                <Button variant="outline" size="sm" className="h-8"
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
