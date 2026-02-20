"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VENDOR_BILL_STATUSES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Search, Loader2, Trash2, RotateCcw } from "lucide-react";
import Link from "next/link";

export default function VendorBillsPage() {
  const { activeCompanyId } = useCompanyStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const utils = trpc.useUtils();

  const { data: bills, isLoading } = trpc.vendorBill.list.useQuery(
    { companyId: activeCompanyId!, search: search || undefined, status: statusFilter || undefined, showDeleted },
    { enabled: !!activeCompanyId }
  );

  const restoreMutation = trpc.vendorBill.restore.useMutation({
    onSuccess: () => utils.vendorBill.list.invalidate(),
  });

  if (!activeCompanyId) return null;

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold flex-1">Vendor Bills</h1>
        <Button
          variant={showDeleted ? "default" : "outline"}
          size="sm"
          onClick={() => { setShowDeleted(!showDeleted); setStatusFilter(""); }}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          {showDeleted ? "Viewing Trash" : "Trash"}
        </Button>
        {!showDeleted && (
          <Link href="/vendor-bills/new">
            <Button><Plus className="h-4 w-4 mr-2" />New Bill</Button>
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search bills..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {!showDeleted && (
          <select
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {VENDOR_BILL_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !bills?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          {showDeleted ? "No deleted vendor bills." : "No vendor bills yet."}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Bill #</th>
                <th className="text-left p-3 font-medium">Vendor</th>
                <th className="text-left p-3 font-medium hidden sm:table-cell">Date</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Due Date</th>
                <th className="text-right p-3 font-medium">Amount</th>
                <th className="text-right p-3 font-medium">{showDeleted ? "Action" : "Balance"}</th>
                {!showDeleted && <th className="text-center p-3 font-medium">Status</th>}
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => {
                const status = VENDOR_BILL_STATUSES.find((s) => s.value === bill.status);
                return (
                  <tr key={bill.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3">
                      {showDeleted ? (
                        <span className="font-mono font-medium text-muted-foreground">{bill.billNumber}</span>
                      ) : (
                        <Link href={`/vendor-bills/${bill.id}`} className="text-primary hover:underline font-mono font-medium">
                          {bill.billNumber}
                        </Link>
                      )}
                    </td>
                    <td className="p-3">{bill.vendor.name}</td>
                    <td className="p-3 hidden sm:table-cell text-muted-foreground">{formatDate(bill.billDate)}</td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground">{formatDate(bill.dueDate)}</td>
                    <td className="p-3 text-right font-medium">{formatCurrency(Number(bill.totalAmount))}</td>
                    <td className="p-3 text-right font-medium">
                      {showDeleted ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => restoreMutation.mutate({ id: bill.id })}
                          disabled={restoreMutation.isPending}
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />
                          Restore
                        </Button>
                      ) : (
                        formatCurrency(Number(bill.balanceDue))
                      )}
                    </td>
                    {!showDeleted && (
                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status?.color ?? ""}`}>
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
      )}
    </div>
  );
}
