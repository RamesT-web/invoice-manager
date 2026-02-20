"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PAYMENT_MODES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Search, Loader2, Trash2, CreditCard } from "lucide-react";
import { format } from "date-fns";

export default function PaymentsPage() {
  const { activeCompanyId } = useCompanyStore();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const utils = trpc.useUtils();

  const { data: payments, isLoading } = trpc.payment.list.useQuery(
    { companyId: activeCompanyId!, search: search || undefined },
    { enabled: !!activeCompanyId }
  );

  // For the record payment dialog, we need unpaid invoices
  const { data: unpaidInvoices } = trpc.invoice.list.useQuery(
    { companyId: activeCompanyId!, status: undefined },
    { enabled: !!activeCompanyId && dialogOpen }
  );

  const openInvoices = unpaidInvoices?.filter(
    (inv) => inv.status === "sent" || inv.status === "partially_paid" || inv.status === "overdue"
  );

  const [formInvoiceId, setFormInvoiceId] = useState("");
  const [formDate, setFormDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formAmount, setFormAmount] = useState(0);
  const [formMode, setFormMode] = useState("bank_transfer");
  const [formRef, setFormRef] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const recordMutation = trpc.payment.record.useMutation({
    onSuccess: () => {
      utils.payment.list.invalidate();
      utils.invoice.list.invalidate();
      setDialogOpen(false);
      resetForm();
    },
  });

  const deleteMutation = trpc.payment.delete.useMutation({
    onSuccess: () => {
      utils.payment.list.invalidate();
      utils.invoice.list.invalidate();
    },
  });

  function resetForm() {
    setFormInvoiceId("");
    setFormDate(format(new Date(), "yyyy-MM-dd"));
    setFormAmount(0);
    setFormMode("bank_transfer");
    setFormRef("");
    setFormNotes("");
  }

  function openNew() {
    resetForm();
    setDialogOpen(true);
  }

  function selectInvoice(invoiceId: string) {
    setFormInvoiceId(invoiceId);
    const inv = openInvoices?.find((i) => i.id === invoiceId);
    if (inv) {
      setFormAmount(Number(inv.balanceDue));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCompanyId || !formInvoiceId || formAmount <= 0) return;
    recordMutation.mutate({
      companyId: activeCompanyId,
      invoiceId: formInvoiceId,
      paymentDate: formDate,
      amount: formAmount,
      paymentMode: formMode,
      referenceNumber: formRef || null,
      notes: formNotes || null,
    });
  }

  if (!activeCompanyId) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Payments</h1>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />
          Record Payment
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search payments..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && (!payments || payments.length === 0) && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CreditCard className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h2 className="text-lg font-medium mb-1">No payments yet</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Record a payment when you receive money for an invoice.
          </p>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            Record Payment
          </Button>
        </div>
      )}

      {!isLoading && payments && payments.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Invoice</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Mode</th>
                  <th className="px-4 py-3 font-medium">Reference</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium w-16"></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3">{formatDate(p.paymentDate)}</td>
                    <td className="px-4 py-3">
                      {p.invoice ? (
                        <Link href={`/invoices/${p.invoice.id}`} className="text-primary hover:underline font-mono text-xs">
                          {p.invoice.invoiceNumber}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">{p.customer?.name ?? "—"}</td>
                    <td className="px-4 py-3 capitalize">{p.paymentMode.replace("_", " ")}</td>
                    <td className="px-4 py-3 font-mono text-xs">{p.referenceNumber || "—"}</td>
                    <td className="px-4 py-3 text-right font-medium text-green-600">
                      {formatCurrency(Number(p.amount))}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => {
                          if (confirm("Delete this payment? The invoice balance will be restored.")) {
                            deleteMutation.mutate({ id: p.id });
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Record Payment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label>Invoice *</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={formInvoiceId}
              onChange={(e) => selectInvoice(e.target.value)}
              required
            >
              <option value="">Select invoice</option>
              {openInvoices?.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoiceNumber} — {inv.customer.name} — Balance: {formatCurrency(Number(inv.balanceDue))}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Payment Date *</Label>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Amount *</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={formAmount}
                onChange={(e) => setFormAmount(parseFloat(e.target.value) || 0)}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Payment Mode</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formMode}
                onChange={(e) => setFormMode(e.target.value)}
              >
                {PAYMENT_MODES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Reference #</Label>
              <Input
                value={formRef}
                onChange={(e) => setFormRef(e.target.value)}
                placeholder="UTR / Cheque No"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Input
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Optional notes"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={recordMutation.isPending || !formInvoiceId}>
              {recordMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Record Payment
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
