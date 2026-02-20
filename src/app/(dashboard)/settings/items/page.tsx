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
import { Plus, Search, Pencil, Trash2, Loader2, ArrowLeft, Save } from "lucide-react";
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

  const createMutation = trpc.item.create.useMutation({
    onSuccess: () => { utils.item.list.invalidate(); setDialogOpen(false); },
  });

  const updateMutation = trpc.item.update.useMutation({
    onSuccess: () => { utils.item.list.invalidate(); setDialogOpen(false); },
  });

  const deleteMutation = trpc.item.delete.useMutation({
    onSuccess: () => utils.item.list.invalidate(),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function openNew() {
    setEditId(null);
    setForm(emptyItem);
    setDialogOpen(true);
  }

  function openEdit(item: { id: string; name: string; description: string | null; hsnSacCode: string | null; type: string; unit: string; defaultRate: unknown; gstRate: unknown }) {
    setEditId(item.id);
    setForm({
      name: item.name,
      description: item.description ?? "",
      hsnSacCode: item.hsnSacCode ?? "",
      type: item.type as "goods" | "service",
      unit: item.unit,
      defaultRate: Number(item.defaultRate),
      gstRate: Number(item.gstRate),
    });
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCompanyId) return;
    if (editId) {
      updateMutation.mutate({ id: editId, ...form });
    } else {
      createMutation.mutate({ companyId: activeCompanyId, ...form });
    }
  }

  if (!activeCompanyId) return null;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold">Items & Services</h1>
        <div className="ml-auto">
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Add Item</Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !items?.length ? (
        <div className="text-center py-12 text-muted-foreground">No items yet.</div>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium hidden sm:table-cell">HSN/SAC</th>
                <th className="text-right p-3 font-medium">Rate</th>
                <th className="text-right p-3 font-medium">GST %</th>
                <th className="text-right p-3 font-medium w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-muted-foreground">{item.type} &middot; {ITEM_UNITS.find(u => u.value === item.unit)?.label ?? item.unit}</div>
                  </td>
                  <td className="p-3 hidden sm:table-cell text-muted-foreground font-mono text-xs">{item.hsnSacCode || "—"}</td>
                  <td className="p-3 text-right">{formatCurrency(Number(item.defaultRate))}</td>
                  <td className="p-3 text-right">{Number(item.gstRate)}%</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("Delete?")) deleteMutation.mutate({ id: item.id }); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogHeader><DialogTitle>{editId ? "Edit" : "New"} Item</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>HSN / SAC Code</Label>
              <Input value={form.hsnSacCode} onChange={(e) => setForm({ ...form, hsnSacCode: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "goods" | "service" })}>
                <option value="service">Service</option>
                <option value="goods">Goods</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Unit</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                {ITEM_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Default Rate</Label>
              <Input type="number" step="0.01" min="0" value={form.defaultRate} onChange={(e) => setForm({ ...form, defaultRate: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-1">
              <Label>GST %</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: parseFloat(e.target.value) })}>
                {GST_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {editId ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
