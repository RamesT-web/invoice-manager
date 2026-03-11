"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ITEM_UNITS, GST_RATES } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { Plus, Search, Pencil, Trash2, Loader2, ArrowLeft, Save, Package } from "lucide-react";
import Link from "next/link";

interface ItemFormData {
  name: string;
  description: string;
  hsnSacCode: string;
  type: "goods" | "service";
  unit: string;
  defaultRate: number;
  gstRate: number;
}

const emptyItem: ItemFormData = {
  name: "", description: "", hsnSacCode: "", type: "service", unit: "nos", defaultRate: 0, gstRate: 18,
};

export default function ItemsPage() {
  const { activeCompanyId } = useCompanyStore();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ItemFormData>(emptyItem);
  const utils = trpc.useUtils();

  const { data: items, isLoading } = trpc.item.list.useQuery(
    { companyId: activeCompanyId!, search: search || undefined },
    { enabled: !!activeCompanyId }
  );

  const createMutation = trpc.item.create.useMutation({ onSuccess: () => { utils.item.list.invalidate(); setDialogOpen(false); } });
  const updateMutation = trpc.item.update.useMutation({ onSuccess: () => { utils.item.list.invalidate(); setDialogOpen(false); } });
  const deleteMutation = trpc.item.delete.useMutation({ onSuccess: () => utils.item.list.invalidate() });
  const isPending = createMutation.isPending || updateMutation.isPending;

  function openNew() { setEditId(null); setForm(emptyItem); setDialogOpen(true); }

  function openEdit(item: { id: string; name: string; description: string | null; hsnSacCode: string | null; type: string; unit: string; defaultRate: unknown; gstRate: unknown }) {
    setEditId(item.id);
    setForm({ name: item.name, description: item.description ?? "", hsnSacCode: item.hsnSacCode ?? "", type: item.type as "goods" | "service", unit: item.unit, defaultRate: Number(item.defaultRate), gstRate: Number(item.gstRate) });
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCompanyId) return;
    if (editId) updateMutation.mutate({ id: editId, ...form });
    else createMutation.mutate({ companyId: activeCompanyId, ...form });
  }

  if (!activeCompanyId) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/settings"><Button variant="ghost" size="icon" className="h-9 w-9"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-xl font-semibold text-gray-900">Items & Services</h1>
        <div className="ml-auto">
          <Button size="sm" className="h-9 bg-blue-600 hover:bg-blue-700" onClick={openNew}><Plus className="h-4 w-4 mr-1.5" />Add Item</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 bg-gray-50 border-gray-200" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : !items?.length ? (
        <div className="bg-white rounded-lg border">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-gray-50 flex items-center justify-center mb-4"><Package className="h-8 w-8 text-gray-300" /></div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">No items yet</h2>
            <p className="text-sm text-gray-500">Add your first item or service to get started.</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="data-table">
            <thead><tr><th>Name</th><th className="hidden sm:table-cell">HSN/SAC</th><th className="text-right">Rate</th><th className="text-right">GST %</th><th className="text-right w-24">Actions</th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="font-medium text-gray-900">{item.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5 capitalize">{item.type} &middot; {ITEM_UNITS.find(u => u.value === item.unit)?.label ?? item.unit}</div>
                  </td>
                  <td className="hidden sm:table-cell text-gray-500 font-mono text-xs">{item.hsnSacCode || "\u2014"}</td>
                  <td className="text-right tabular-nums">{formatCurrency(Number(item.defaultRate))}</td>
                  <td className="text-right tabular-nums">{Number(item.gstRate)}%</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-0.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-blue-600" onClick={() => openEdit(item)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500" onClick={() => { if (confirm("Delete this item?")) deleteMutation.mutate({ id: item.id }); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogHeader><DialogTitle>{editId ? "Edit" : "New"} Item</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="h-9 bg-gray-50 border-gray-200" /></div>
          <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="h-9 bg-gray-50 border-gray-200" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">HSN / SAC Code</Label><Input value={form.hsnSacCode} onChange={(e) => setForm({ ...form, hsnSacCode: e.target.value })} className="h-9 bg-gray-50 border-gray-200 font-mono" /></div>
            <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Type</Label><select className="flex h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "goods" | "service" })}><option value="service">Service</option><option value="goods">Goods</option></select></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Unit</Label><select className="flex h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>{ITEM_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}</select></div>
            <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Default Rate</Label><Input type="number" step="0.01" min="0" value={form.defaultRate} onChange={(e) => setForm({ ...form, defaultRate: parseFloat(e.target.value) || 0 })} className="h-9 bg-gray-50 border-gray-200 tabular-nums" /></div>
            <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">GST %</Label><select className="flex h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: parseFloat(e.target.value) })}>{GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}</select></div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" className="h-9" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" className="h-9 bg-blue-600 hover:bg-blue-700" disabled={isPending}>{isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}{editId ? "Update" : "Create"}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
