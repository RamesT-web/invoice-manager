"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GST_RATES } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { calcLineItem, calcInvoiceTotals, isInterState as checkInterState } from "@/server/services/gst";
import { ArrowLeft, Plus, Trash2, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { addDays, format } from "date-fns";

interface LineItem {
  key: string;
  itemId: string | null;
  description: string;
  hsnSacCode: string;
  quantity: number;
  unit: string;
  rate: number;
  gstRate: number;
  discountType: "percentage" | "fixed" | null;
  discountValue: number;
}

function newLine(): LineItem {
  return {
    key: Math.random().toString(36).slice(2),
    itemId: null,
    description: "",
    hsnSacCode: "",
    quantity: 1,
    unit: "nos",
    rate: 0,
    gstRate: 18,
    discountType: null,
    discountValue: 0,
  };
}

export default function NewInvoicePage() {
  const router = useRouter();
  const { activeCompanyId } = useCompanyStore();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: company } = trpc.company.get.useQuery(
    { id: activeCompanyId! },
    { enabled: !!activeCompanyId }
  );
  const { data: customers } = trpc.customer.list.useQuery(
    { companyId: activeCompanyId! },
    { enabled: !!activeCompanyId }
  );
  const { data: items } = trpc.item.list.useQuery(
    { companyId: activeCompanyId! },
    { enabled: !!activeCompanyId }
  );

  const [customerId, setCustomerId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), 30), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([newLine()]);

  const createMutation = trpc.invoice.create.useMutation({
    onSuccess: (inv) => router.push(`/invoices/${inv.id}`),
  });

  // Selected customer's state for GST
  const selectedCustomer = customers?.find((c) => c.id === customerId);
  const placeOfSupply = selectedCustomer?.billingState ?? "";
  const interState = checkInterState(company?.state, placeOfSupply);

  // Calculate totals client-side for live preview
  const calculated = useMemo(() => {
    const lineCalcs = lines.map((line) =>
      calcLineItem(
        { quantity: line.quantity, rate: line.rate, gstRate: line.gstRate, discountType: line.discountType, discountValue: line.discountValue },
        interState
      )
    );
    const totals = calcInvoiceTotals(lineCalcs);
    return { lineCalcs, totals };
  }, [lines, interState]);

  function updateLine(idx: number, updates: Partial<LineItem>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...updates } : l)));
  }

  function removeLine(idx: number) {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function selectItem(idx: number, itemId: string) {
    const item = items?.find((i) => i.id === itemId);
    if (item) {
      updateLine(idx, {
        itemId: item.id,
        description: item.name,
        hsnSacCode: item.hsnSacCode ?? "",
        unit: item.unit,
        rate: Number(item.defaultRate),
        gstRate: Number(item.gstRate),
      });
    }
  }

  function handleSubmit(status: "draft" | "sent") {
    if (!activeCompanyId || !customerId || lines.every((l) => !l.description)) return;

    createMutation.mutate({
      companyId: activeCompanyId,
      customerId,
      invoiceDate,
      dueDate,
      placeOfSupply: placeOfSupply || null,
      notes: notes || company?.defaultTerms || null,
      status,
      lines: lines
        .filter((l) => l.description)
        .map((l, idx) => ({
          itemId: l.itemId,
          description: l.description,
          hsnSacCode: l.hsnSacCode || null,
          quantity: l.quantity,
          unit: l.unit,
          rate: l.rate,
          gstRate: l.gstRate,
          discountType: l.discountType,
          discountValue: l.discountValue || null,
          sortOrder: idx,
        })),
    });
  }

  // Set due date when invoice date or customer changes
  function updateInvoiceDate(date: string) {
    setInvoiceDate(date);
    const days = selectedCustomer?.paymentTermsDays ?? company?.defaultPaymentTermsDays ?? 30;
    setDueDate(format(addDays(new Date(date), days), "yyyy-MM-dd"));
  }

  if (!activeCompanyId) return null;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/invoices"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-2xl font-bold">New Invoice</h1>
      </div>

      {/* Header */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-1">
              <Label>Customer *</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
              >
                <option value="">Select customer</option>
                {customers?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Invoice Date</Label>
              <Input type="date" value={invoiceDate} onChange={(e) => updateInvoiceDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Due Date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          {selectedCustomer && (
            <div className="text-xs text-muted-foreground">
              {selectedCustomer.gstin && <span className="font-mono">GSTIN: {selectedCustomer.gstin} &middot; </span>}
              {selectedCustomer.billingStateName ?? ""}
              {interState && <span className="ml-2 text-orange-600 font-medium">(Inter-state — IGST)</span>}
              {!interState && placeOfSupply && <span className="ml-2 text-green-600 font-medium">(Intra-state — CGST+SGST)</span>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Line Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Header row - desktop */}
          <div className="hidden md:grid md:grid-cols-[1fr_200px_80px_100px_70px_100px_40px] gap-2 text-xs font-medium text-muted-foreground px-1">
            <div>Description</div>
            <div>Item</div>
            <div className="text-right">Qty</div>
            <div className="text-right">Rate</div>
            <div className="text-right">GST%</div>
            <div className="text-right">Total</div>
            <div></div>
          </div>

          {lines.map((line, idx) => (
            <div key={line.key} className="grid grid-cols-1 md:grid-cols-[1fr_200px_80px_100px_70px_100px_40px] gap-2 items-start p-2 md:p-0 border md:border-0 rounded-lg md:rounded-none">
              <div className="space-y-1">
                <Label className="md:hidden text-xs">Description *</Label>
                <Input
                  placeholder="Description"
                  value={line.description}
                  onChange={(e) => updateLine(idx, { description: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="md:hidden text-xs">Item preset</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
                  value={line.itemId ?? ""}
                  onChange={(e) => selectItem(idx, e.target.value)}
                >
                  <option value="">Pick item...</option>
                  {items?.map((it) => (
                    <option key={it.id} value={it.id}>{it.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="md:hidden text-xs">Qty</Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  className="text-right"
                  value={line.quantity}
                  onChange={(e) => updateLine(idx, { quantity: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1">
                <Label className="md:hidden text-xs">Rate</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="text-right"
                  value={line.rate}
                  onChange={(e) => updateLine(idx, { rate: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1">
                <Label className="md:hidden text-xs">GST%</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-1 py-2 text-sm text-right"
                  value={line.gstRate}
                  onChange={(e) => updateLine(idx, { gstRate: parseFloat(e.target.value) })}
                >
                  {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                </select>
              </div>
              <div className="text-right self-center font-medium text-sm pt-2 md:pt-0">
                {formatCurrency(calculated.lineCalcs[idx]?.lineTotal ?? 0)}
              </div>
              <div className="self-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  onClick={() => removeLine(idx)}
                  disabled={lines.length <= 1}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={() => setLines([...lines, newLine()])}>
            <Plus className="h-4 w-4 mr-1" />
            Add Line
          </Button>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(calculated.totals.subtotal)}</span>
              </div>
              {calculated.totals.discountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(calculated.totals.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Taxable</span>
                <span>{formatCurrency(calculated.totals.taxableAmount)}</span>
              </div>
              {!interState ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CGST</span>
                    <span>{formatCurrency(calculated.totals.cgstAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">SGST</span>
                    <span>{formatCurrency(calculated.totals.sgstAmount)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IGST</span>
                  <span>{formatCurrency(calculated.totals.igstAmount)}</span>
                </div>
              )}
              <div className="border-t pt-1 flex justify-between font-bold text-base">
                <span>Total</span>
                <span>{formatCurrency(calculated.totals.totalAmount)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardContent className="pt-6">
          <Label>Notes / Terms</Label>
          <textarea
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] mt-1"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={company?.defaultTerms ?? "Add notes or terms..."}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3 pb-6">
        <Link href="/invoices"><Button variant="outline">Cancel</Button></Link>
        <Button
          variant="outline"
          onClick={() => handleSubmit("draft")}
          disabled={createMutation.isPending || !customerId}
        >
          {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save Draft
        </Button>
        <Button
          onClick={() => handleSubmit("sent")}
          disabled={createMutation.isPending || !customerId}
        >
          {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save & Mark Sent
        </Button>
      </div>
    </div>
  );
}
