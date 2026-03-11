"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PAYMENT_MODES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Search, Loader2, Trash2, CreditCard } from "lucide-react";
import { format } from "date-fns";

export default function PaymentsPage() {
  const { activeCompanyId } = useCompanyStore();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const debouncedSearch = useDebounce(search);
  const utils = trpc.useUtils();

  const { data: payments, isLoading } = trpc.payment.list.useQuery(
    { companyId: activeCompanyId!, search: debouncedSearch || undefined, type: (typeFilter as "received" | "made") || undefined, paymentMode: modeFilter || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined },
    { enabled: !!activeCompanyId }
  );

  const { data: unpaidInvoicesData } = trpc.invoice.list.useQuery(
    { companyId: activeCompanyId!, status: undefined, pageSize: 100 },
    { enabled: !!activeCompanyId && dialogOpen }
  );
  const openInvoices = unpaidInvoicesData?.invoices?.filter((inv) => inv.status === "sent" || inv.status === "partially_paid" || inv.status === "overdue");

  const [formInvoiceId, setFormInvoiceId] = useState("");
  const [formDate, setFormDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formAmount, setFormAmount] = useState(0);
  const [formMode, setFormMode] = useState("bank_transfer");
  const [formRef, setFormRef] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const recordMutation = trpc.payment.record.useMutation({ onSuccess: () => { utils.payment.list.invalidate(); utils.invoice.list.invalidate(); setDialogOpen(false); resetForm(); } });
  const deleteMutation = trpc.payment.delete.useMutation({ onSuccess: () => { utils.payment.list.invalidate(); utils.invoice.list.invalidate(); } });

  function resetForm() { setFormInvoiceId(""); setFormDate(format(new Date(), "yyyy-MM-dd")); setFormAmount(0); setFormMode("bank_transfer"); setFormRef(""); setFormNotes(""); }
  function openNew() { resetForm(); setDialogOpen(true); }
  function selectInvoice(invoiceId: string) { setFormInvoiceId(invoiceId); const inv = openInvoices?.find((i) => i.id === invoiceId); if (inv) setFormAmount(Number(inv.balanceDue)); }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCompanyId || !formInvoiceId || formAmount <= 0) return;
    recordMutation.mutate({ companyId: activeCompanyId, invoiceId: formInvoiceId, paymentDate: formDate, amount: formAmount, paymentMode: formMode, referenceNumber: formRef || null, notes: formNotes || null });
  }

  if (!activeCompanyId) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Payments</h1>
        <Button size="sm" className="h-9 bg-blue-600 hover:bg-blue-700" onClick={openNew}><Plus className="h-4 w-4 mr-1.5" />Record Payment</Button>
      </div>

      <div className="bg-white rounded-lg border p-4 space-y-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="Search payments..." className="pl-9 h-9 bg-gray-50 border-gray-200" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="flex h-9 rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option><option value="received">Received</option><option value="made">Made</option>
          </select>
          <select className="flex h-9 rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}>
            <option value="">All modes</option>{PAYMENT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div className="flex gap-2 items-center">
          <Input type="date" className="w-[140px] h-9 bg-gray-50 border-gray-200 text-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <span className="text-xs text-gray-400 font-medium">to</span>
          <Input type="date" className="w-[140px] h-9 bg-gray-50 border-gray-200 text-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          {(dateFrom || dateTo || typeFilter || modeFilter) && <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={() => { setDateFrom(""); setDateTo(""); setTypeFilter(""); setModeFilter(""); }}>Clear</Button>}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : !payments?.length ? (
        <div className="bg-white rounded-lg border">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-gray-50 flex items-center justify-center mb-4"><CreditCard className="h-8 w-8 text-gray-300" /></div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">No payments found</h2>
            <p className="text-sm text-gray-500">{search || typeFilter || modeFilter || dateFrom || dateTo ? "Try adjusting your search or filters." : "Record a payment when you receive money for an invoice."}</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Type</th><th>Invoice / Bill</th><th className="hidden md:table-cell">Customer / Vendor</th><th className="hidden sm:table-cell">Mode</th><th className="hidden lg:table-cell">Reference</th><th className="text-right">Amount</th><th className="w-12"></th></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="text-gray-900">{formatDate(p.paymentDate)}</td>
                  <td><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.type === "received" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{p.type === "received" ? "Received" : "Made"}</span></td>
                  <td>{p.type === "received" && p.invoice ? <Link href={`/invoices/${p.invoice.id}`} className="font-mono text-xs text-blue-600 hover:text-blue-700">{p.invoice.invoiceNumber}</Link> : p.type === "made" && p.vendorBill ? <Link href={`/vendor-bills/${p.vendorBill.id}`} className="font-mono text-xs text-blue-600 hover:text-blue-700">{p.vendorBill.billNumber}</Link> : "\u2014"}</td>
                  <td className="hidden md:table-cell text-gray-500">{p.type === "received" ? p.customer?.name ?? "\u2014" : p.vendor?.name ?? "\u2014"}</td>
                  <td className="hidden sm:table-cell text-gray-500 capitalize">{p.paymentMode.replace(/_/g, " ")}</td>
                  <td className="hidden lg:table-cell font-mono text-xs text-gray-500">{p.referenceNumber || "\u2014"}</td>
                  <td className={`text-right font-semibold tabular-nums ${p.type === "received" ? "text-green-600" : "text-red-600"}`}>{p.type === "made" ? "- " : ""}{formatCurrency(Number(p.amount))}</td>
                  <td><Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500" onClick={() => { if (confirm("Delete this payment? The invoice/bill balance will be restored.")) deleteMutation.mutate({ id: p.id }); }}><Trash2 className="h-3.5 w-3.5" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Invoice *</Label>
            <select className="flex h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={formInvoiceId} onChange={(e) => selectInvoice(e.target.value)} required>
              <option value="">Select invoice</option>{openInvoices?.map((inv) => <option key={inv.id} value={inv.id}>{inv.invoiceNumber} — {inv.customer.name} — Balance: {formatCurrency(Number(inv.balanceDue))}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Payment Date *</Label><Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required className="h-9 bg-gray-50 border-gray-200" /></div>
            <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Amount *</Label><Input type="number" step="0.01" min="0.01" value={formAmount} onChange={(e) => setFormAmount(parseFloat(e.target.value) || 0)} required className="h-9 bg-gray-50 border-gray-200 tabular-nums" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Payment Mode</Label><select className="flex h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={formMode} onChange={(e) => setFormMode(e.target.value)}>{PAYMENT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></div>
            <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Reference #</Label><Input value={formRef} onChange={(e) => setFormRef(e.target.value)} placeholder="UTR / Cheque No" className="h-9 bg-gray-50 border-gray-200" /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Notes</Label><Input value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Optional notes" className="h-9 bg-gray-50 border-gray-200" /></div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" className="h-9" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" className="h-9 bg-blue-600 hover:bg-blue-700" disabled={recordMutation.isPending || !formInvoiceId}>{recordMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Record Payment</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
