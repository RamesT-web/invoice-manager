"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INDIAN_STATES, GST_RATES } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { format, addDays } from "date-fns";

interface LineItem {
  description: string;
  hsnSacCode: string;
  quantity: number;
  unit: string;
  rate: number;
  gstRate: number;
}

const emptyLine: LineItem = { description: "", hsnSacCode: "", quantity: 1, unit: "nos", rate: 0, gstRate: 18 };

export default function NewVendorBillPage() {
  const router = useRouter();
  const { activeCompanyId } = useCompanyStore();
  const [vendorId, setVendorId] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [billDate, setBillDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), 30), "yyyy-MM-dd"));
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([{ ...emptyLine }]);

  const { data: vendors } = trpc.vendor.list.useQuery(
    { companyId: activeCompanyId! },
    { enabled: !!activeCompanyId }
  );
  const { data: items } = trpc.item.list.useQuery(
    { companyId: activeCompanyId! },
    { enabled: !!activeCompanyId }
  );

  const createMutation = trpc.vendorBill.create.useMutation({
    onSuccess: (data) => router.push(`/vendor-bills/${data.id}`),
  });

  function addLine() { setLines([...lines, { ...emptyLine }]); }
  function removeLine(idx: number) { if (lines.length <= 1) return; setLines(lines.filter((_, i) => i !== idx)); }
  function updateLine(idx: number, field: string, value: unknown) { const updated = [...lines]; updated[idx] = { ...updated[idx], [field]: value }; setLines(updated); }

  function selectItem(idx: number, itemId: string) {
    const item = items?.find((i) => i.id === itemId);
    if (item) {
      updateLine(idx, "description", item.name);
      updateLine(idx, "hsnSacCode", item.hsnSacCode ?? "");
      updateLine(idx, "rate", Number(item.defaultRate));
      updateLine(idx, "gstRate", Number(item.gstRate));
      updateLine(idx, "unit", item.unit);
    }
  }

  function calcLineTotal(line: LineItem) { return line.quantity * line.rate * (1 + line.gstRate / 100); }
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.rate, 0);
  const totalGst = lines.reduce((s, l) => s + l.quantity * l.rate * l.gstRate / 100, 0);
  const grandTotal = subtotal + totalGst;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCompanyId || !vendorId || !billNumber) return;
    createMutation.mutate({
      companyId: activeCompanyId, vendorId, billNumber, billDate, dueDate,
      placeOfSupply: placeOfSupply || null, notes: notes || null,
      lines: lines.filter((l) => l.description && l.rate > 0).map((l, i) => ({
        description: l.description, hsnSacCode: l.hsnSacCode || null, quantity: l.quantity,
        unit: l.unit, rate: l.rate, gstRate: l.gstRate, sortOrder: i,
      })),
    });
  }

  if (!activeCompanyId) return null;

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/vendor-bills"><Button variant="ghost" size="icon" className="h-9 w-9"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-xl font-semibold text-gray-900">New Vendor Bill</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Bill Details</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-sm font-medium text-gray-700">Vendor *</Label>
              <select className="flex h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={vendorId} onChange={(e) => setVendorId(e.target.value)} required>
                <option value="">Select vendor...</option>
                {vendors?.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Bill Number *</Label>
              <Input value={billNumber} onChange={(e) => setBillNumber(e.target.value)} required placeholder="e.g. VB-001" className="h-9 bg-gray-50 border-gray-200" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Place of Supply</Label>
              <select className="flex h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={placeOfSupply} onChange={(e) => setPlaceOfSupply(e.target.value)}>
                <option value="">Select...</option>
                {INDIAN_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Bill Date *</Label>
              <Input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} required className="h-9 bg-gray-50 border-gray-200" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Due Date *</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required className="h-9 bg-gray-50 border-gray-200" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border">
          <div className="px-6 py-4 border-b"><h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Line Items</h2></div>
          <div className="p-6 space-y-3">
            <div className="hidden md:grid md:grid-cols-[140px_1fr_60px_100px_60px_100px_36px] gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400 px-1">
              <div>Item</div><div>Description</div><div className="text-right">Qty</div><div className="text-right">Rate</div><div className="text-right">GST%</div><div className="text-right">Total</div><div></div>
            </div>
            {lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-[140px_1fr_60px_100px_60px_100px_36px] gap-2 items-start p-3 md:p-0 border md:border-0 rounded-lg md:rounded-none bg-gray-50/50 md:bg-transparent">
                <div className="space-y-1">
                  <Label className="md:hidden text-xs text-gray-500">Item</Label>
                  <select className="flex h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" onChange={(e) => { if (e.target.value) selectItem(idx, e.target.value); }} defaultValue="">
                    <option value="">Pick item...</option>
                    {items?.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="md:hidden text-xs text-gray-500">Description</Label>
                  <Input className="h-9 bg-gray-50 border-gray-200" value={line.description} onChange={(e) => updateLine(idx, "description", e.target.value)} placeholder="Description" />
                </div>
                <div className="space-y-1">
                  <Label className="md:hidden text-xs text-gray-500">Qty</Label>
                  <Input className="h-9 text-right bg-gray-50 border-gray-200 tabular-nums" type="number" min="0" step="0.01" value={line.quantity} onChange={(e) => updateLine(idx, "quantity", parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-1">
                  <Label className="md:hidden text-xs text-gray-500">Rate</Label>
                  <Input className="h-9 text-right bg-gray-50 border-gray-200 tabular-nums" type="number" min="0" step="0.01" value={line.rate} onChange={(e) => updateLine(idx, "rate", parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-1">
                  <Label className="md:hidden text-xs text-gray-500">GST%</Label>
                  <select className="flex h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-1 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={line.gstRate} onChange={(e) => updateLine(idx, "gstRate", parseFloat(e.target.value))}>
                    {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                  </select>
                </div>
                <div className="text-right self-center font-semibold text-sm tabular-nums pt-2 md:pt-0 text-gray-900">{formatCurrency(calcLineTotal(line))}</div>
                <div className="self-center">
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500" onClick={() => removeLine(idx)} disabled={lines.length <= 1}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={addLine}><Plus className="h-3.5 w-3.5 mr-1" />Add Line</Button>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="tabular-nums">{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">GST</span><span className="tabular-nums">{formatCurrency(totalGst)}</span></div>
              <div className="border-t-2 border-gray-900 pt-2 flex justify-between font-bold text-base"><span>Total</span><span className="tabular-nums">{formatCurrency(grandTotal)}</span></div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <Label className="text-sm font-medium text-gray-700">Notes</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes..." className="mt-1.5 h-9 bg-gray-50 border-gray-200" />
        </div>

        <div className="flex justify-end gap-3 pb-6">
          <Link href="/vendor-bills"><Button type="button" variant="outline" className="h-9">Cancel</Button></Link>
          <Button type="submit" className="h-9 bg-blue-600 hover:bg-blue-700" disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Create Bill
          </Button>
        </div>
      </form>
    </div>
  );
}
