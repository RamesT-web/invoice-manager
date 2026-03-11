"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  const selectedCustomer = customers?.find((c) => c.id === customerId);
  const placeOfSupply = selectedCustomer?.billingState ?? "";
  const interState = checkInterState(company?.state, placeOfSupply);

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

  function updateInvoiceDate(date: string) {
    setInvoiceDate(date);
    const days = selectedCustomer?.paymentTermsDays ?? company?.defaultPaymentTermsDays ?? 30;
    setDueDate(format(addDays(new Date(date), days), "yyyy-MM-dd"));
  }

  if (!activeCompanyId) return null;

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Link href="/invoices">
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">New Invoice</h1>
      </div>

      {/* Header fields */}
      <div className="bg-white rounded-lg border p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5 sm:col-span-1">
            <Label className="text-sm font-medium text-gray-700">Customer *</Label>
            <select
              className="flex h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
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
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Invoice Date</Label>
            <Input type="date" value={invoiceDate} onChange={(e) => updateInvoiceDate(e.target.value)} className="h-9 bg-gray-50 border-gray-200" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Due Date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-9 bg-gray-50 border-gray-200" />
          </div>
        </div>
        {selectedCustomer && (
          <div className="text-xs text-gray-500">
            {selectedCustomer.gstin && <span className="font-mono">GSTIN: {selectedCustomer.gstin} &middot; </span>}
            {selectedCustomer.billingStateName ?? ""}
            {interState && <span className="ml-2 text-orange-600 font-medium">(Inter-state — IGST)</span>}
            {!interState && placeOfSupply && <span className="ml-2 text-green-600 font-medium">(Intra-state — CGST+SGST)</span>}
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className="bg-white rounded-lg border">
        <div className="px-6 py-4 border-b">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Line Items</h2>
        </div>
        <div className="p-6 space-y-3">
          <div className="hidden md:grid md:grid-cols-[1fr_180px_70px_100px_70px_100px_36px] gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400 px-1">
            <div>Description</div>
            <div>Item</div>
            <div className="text-right">Qty</div>
            <div className="text-right">Rate</div>
            <div className="text-right">GST%</div>
            <div className="text-right">Total</div>
            <div></div>
          </div>

          {lines.map((line, idx) => (
            <div key={line.key} className="grid grid-cols-1 md:grid-cols-[1fr_180px_70px_100px_70px_100px_36px] gap-2 items-start p-3 md:p-0 border md:border-0 rounded-lg md:rounded-none bg-gray-50/50 md:bg-transparent">
              <div className="space-y-1">
                <Label className="md:hidden text-xs text-gray-500">Description *</Label>
                <Input placeholder="Description" value={line.description} onChange={(e) => updateLine(idx, { description: e.target.value })} className="h-9 bg-gray-50 border-gray-200" />
              </div>
              <div className="space-y-1">
                <Label className="md:hidden text-xs text-gray-500">Item preset</Label>
                <select className="flex h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={line.itemId ?? ""} onChange={(e) => selectItem(idx, e.target.value)}>
                  <option value="">Pick item...</option>
                  {items?.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="md:hidden text-xs text-gray-500">Qty</Label>
                <Input type="number" step="0.001" min="0" className="h-9 text-right bg-gray-50 border-gray-200 tabular-nums" value={line.quantity} onChange={(e) => updateLine(idx, { quantity: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <Label className="md:hidden text-xs text-gray-500">Rate</Label>
                <Input type="number" step="0.01" min="0" className="h-9 text-right bg-gray-50 border-gray-200 tabular-nums" value={line.rate} onChange={(e) => updateLine(idx, { rate: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <Label className="md:hidden text-xs text-gray-500">GST%</Label>
                <select className="flex h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-1 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" value={line.gstRate} onChange={(e) => updateLine(idx, { gstRate: parseFloat(e.target.value) })}>
                  {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                </select>
              </div>
              <div className="text-right self-center font-semibold text-sm tabular-nums pt-2 md:pt-0 text-gray-900">
                {formatCurrency(calculated.lineCalcs[idx]?.lineTotal ?? 0)}
              </div>
              <div className="self-center">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500" onClick={() => removeLine(idx)} disabled={lines.length <= 1}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}

          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setLines([...lines, newLine()])}>
            <Plus className="h-3.5 w-3.5 mr-1" />Add Line
          </Button>
        </div>
      </div>

      {/* Totals */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex justify-end">
          <div className="w-full max-w-xs space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="tabular-nums">{formatCurrency(calculated.totals.subtotal)}</span></div>
            {calculated.totals.discountAmount > 0 && (
              <div className="flex justify-between text-green-600"><span>Discount</span><span className="tabular-nums">-{formatCurrency(calculated.totals.discountAmount)}</span></div>
            )}
            <div className="flex justify-between"><span className="text-gray-500">Taxable</span><span className="tabular-nums">{formatCurrency(calculated.totals.taxableAmount)}</span></div>
            {!interState ? (
              <>
                <div className="flex justify-between"><span className="text-gray-500">CGST</span><span className="tabular-nums">{formatCurrency(calculated.totals.cgstAmount)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">SGST</span><span className="tabular-nums">{formatCurrency(calculated.totals.sgstAmount)}</span></div>
              </>
            ) : (
              <div className="flex justify-between"><span className="text-gray-500">IGST</span><span className="tabular-nums">{formatCurrency(calculated.totals.igstAmount)}</span></div>
            )}
            <div className="border-t-2 border-gray-900 pt-2 flex justify-between font-bold text-base">
              <span>Total</span><span className="tabular-nums">{formatCurrency(calculated.totals.totalAmount)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-lg border p-6">
        <Label className="text-sm font-medium text-gray-700">Notes / Terms</Label>
        <textarea
          className="flex w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm min-h-[80px] mt-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={company?.defaultTerms ?? "Add notes or terms..."}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pb-6">
        <Link href="/invoices"><Button variant="outline" className="h-9">Cancel</Button></Link>
        <Button variant="outline" className="h-9" onClick={() => handleSubmit("draft")} disabled={createMutation.isPending || !customerId}>
          {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save Draft
        </Button>
        <Button className="h-9 bg-blue-600 hover:bg-blue-700" onClick={() => handleSubmit("sent")} disabled={createMutation.isPending || !customerId}>
          {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save & Mark Sent
        </Button>
      </div>
    </div>
  );
}
