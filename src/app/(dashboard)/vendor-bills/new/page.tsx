"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  function addLine() {
    setLines([...lines, { ...emptyLine }]);
  }

  function removeLine(idx: number) {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== idx));
  }

  function updateLine(idx: number, field: string, value: unknown) {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], [field]: value };
    setLines(updated);
  }

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

  function calcLineTotal(line: LineItem) {
    const taxable = line.quantity * line.rate;
    const gst = taxable * line.gstRate / 100;
    return taxable + gst;
  }

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.rate, 0);
  const totalGst = lines.reduce((s, l) => s + l.quantity * l.rate * l.gstRate / 100, 0);
  const grandTotal = subtotal + totalGst;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCompanyId || !vendorId || !billNumber) return;
    createMutation.mutate({
      companyId: activeCompanyId,
      vendorId,
      billNumber,
      billDate,
      dueDate,
      placeOfSupply: placeOfSupply || null,
      notes: notes || null,
      lines: lines.filter((l) => l.description && l.rate > 0).map((l, i) => ({
        description: l.description,
        hsnSacCode: l.hsnSacCode || null,
        quantity: l.quantity,
        unit: l.unit,
        rate: l.rate,
        gstRate: l.gstRate,
        sortOrder: i,
      })),
    });
  }

  if (!activeCompanyId) return null;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/vendor-bills">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold">New Vendor Bill</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader><CardTitle>Bill Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1 col-span-2">
                <Label>Vendor *</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={vendorId} onChange={(e) => setVendorId(e.target.value)} required>
                  <option value="">Select vendor...</option>
                  {vendors?.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Bill Number *</Label>
                <Input value={billNumber} onChange={(e) => setBillNumber(e.target.value)} required placeholder="e.g. VB-001" />
              </div>
              <div className="space-y-1">
                <Label>Place of Supply</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={placeOfSupply} onChange={(e) => setPlaceOfSupply(e.target.value)}>
                  <option value="">Select...</option>
                  {INDIAN_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Bill Date *</Label>
                <Input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>Due Date *</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
              </div>
            </div>

            {/* Line items */}
            <div className="space-y-2">
              <Label>Line Items</Label>
              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-3 space-y-1">
                    {idx === 0 && <Label className="text-xs">Item</Label>}
                    <select className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm" onChange={(e) => { if (e.target.value) selectItem(idx, e.target.value); }} defaultValue="">
                      <option value="">Pick item...</option>
                      {items?.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-3 space-y-1">
                    {idx === 0 && <Label className="text-xs">Description</Label>}
                    <Input className="h-9" value={line.description} onChange={(e) => updateLine(idx, "description", e.target.value)} placeholder="Description" />
                  </div>
                  <div className="col-span-1 space-y-1">
                    {idx === 0 && <Label className="text-xs">Qty</Label>}
                    <Input className="h-9" type="number" min="0" step="0.01" value={line.quantity} onChange={(e) => updateLine(idx, "quantity", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="col-span-2 space-y-1">
                    {idx === 0 && <Label className="text-xs">Rate</Label>}
                    <Input className="h-9" type="number" min="0" step="0.01" value={line.rate} onChange={(e) => updateLine(idx, "rate", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="col-span-1 space-y-1">
                    {idx === 0 && <Label className="text-xs">GST%</Label>}
                    <select className="flex h-9 w-full rounded-md border border-input bg-background px-1 py-1 text-sm" value={line.gstRate} onChange={(e) => updateLine(idx, "gstRate", parseFloat(e.target.value))}>
                      {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  </div>
                  <div className="col-span-1 space-y-1 text-right">
                    {idx === 0 && <Label className="text-xs">Total</Label>}
                    <p className="h-9 flex items-center justify-end text-sm font-medium">{formatCurrency(calcLineTotal(line))}</p>
                  </div>
                  <div className="col-span-1">
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeLine(idx)} disabled={lines.length <= 1}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addLine}><Plus className="h-3.5 w-3.5 mr-1" />Add Line</Button>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-full max-w-xs space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GST</span>
                  <span>{formatCurrency(totalGst)}</span>
                </div>
                <div className="border-t pt-1 flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span>{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes..." />
            </div>

            <div className="flex justify-end gap-3">
              <Link href="/vendor-bills"><Button type="button" variant="outline">Cancel</Button></Link>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Create Bill
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
