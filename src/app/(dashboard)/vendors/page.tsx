"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { INDIAN_STATES } from "@/lib/constants";
import { Plus, Search, Pencil, Trash2, Loader2, Save, RotateCcw, BookOpen } from "lucide-react";
import Link from "next/link";

interface VendorForm {
  name: string;
  gstin: string;
  pan: string;
  addressLine1: string;
  city: string;
  state: string;
  stateName: string;
  pincode: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  paymentTermsDays: number | null;
  notes: string;
}

const emptyForm: VendorForm = {
  name: "", gstin: "", pan: "", addressLine1: "", city: "", state: "", stateName: "",
  pincode: "", contactName: "", contactEmail: "", contactPhone: "", paymentTermsDays: null, notes: "",
};

export default function VendorsPage() {
  const { activeCompanyId } = useCompanyStore();
  const [search, setSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<VendorForm>(emptyForm);
  const utils = trpc.useUtils();

  const { data: vendors, isLoading } = trpc.vendor.list.useQuery(
    { companyId: activeCompanyId!, search: search || undefined, showDeleted },
    { enabled: !!activeCompanyId }
  );

  const createMutation = trpc.vendor.create.useMutation({
    onSuccess: () => { utils.vendor.list.invalidate(); setDialogOpen(false); },
  });
  const updateMutation = trpc.vendor.update.useMutation({
    onSuccess: () => { utils.vendor.list.invalidate(); setDialogOpen(false); },
  });
  const deleteMutation = trpc.vendor.delete.useMutation({
    onSuccess: () => utils.vendor.list.invalidate(),
  });
  const restoreMutation = trpc.vendor.restore.useMutation({
    onSuccess: () => utils.vendor.list.invalidate(),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function openNew() {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(v: { id: string; name: string; gstin: string | null; pan: string | null; addressLine1: string | null; city: string | null; state: string | null; stateName: string | null; pincode: string | null; contactName: string | null; contactEmail: string | null; contactPhone: string | null; paymentTermsDays: number | null; notes: string | null }) {
    setEditId(v.id);
    setForm({
      name: v.name, gstin: v.gstin ?? "", pan: v.pan ?? "",
      addressLine1: v.addressLine1 ?? "", city: v.city ?? "",
      state: v.state ?? "", stateName: v.stateName ?? "", pincode: v.pincode ?? "",
      contactName: v.contactName ?? "", contactEmail: v.contactEmail ?? "",
      contactPhone: v.contactPhone ?? "", paymentTermsDays: v.paymentTermsDays,
      notes: v.notes ?? "",
    });
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCompanyId) return;
    const data = {
      ...form,
      gstin: form.gstin || null,
      pan: form.pan || null,
      addressLine1: form.addressLine1 || null,
      city: form.city || null,
      state: form.state || null,
      stateName: form.stateName || null,
      pincode: form.pincode || null,
      contactName: form.contactName || null,
      contactEmail: form.contactEmail || null,
      contactPhone: form.contactPhone || null,
      notes: form.notes || null,
    };
    if (editId) {
      updateMutation.mutate({ id: editId, ...data });
    } else {
      createMutation.mutate({ companyId: activeCompanyId, ...data });
    }
  }

  if (!activeCompanyId) return null;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold flex-1">Vendors</h1>
        <Button
          variant={showDeleted ? "default" : "outline"}
          size="sm"
          onClick={() => setShowDeleted(!showDeleted)}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          {showDeleted ? "Viewing Trash" : "Trash"}
        </Button>
        {!showDeleted && (
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Add Vendor</Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search vendors..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !vendors?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          {showDeleted ? "No deleted vendors." : "No vendors yet."}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium hidden sm:table-cell">GSTIN</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Contact</th>
                <th className="text-right p-3 font-medium w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3">
                    <div className="font-medium">{v.name}</div>
                    {v.city && <div className="text-xs text-muted-foreground">{v.city}{v.stateName ? `, ${v.stateName}` : ""}</div>}
                  </td>
                  <td className="p-3 hidden sm:table-cell font-mono text-xs text-muted-foreground">{v.gstin || "—"}</td>
                  <td className="p-3 hidden md:table-cell text-muted-foreground text-xs">{v.contactEmail || v.contactPhone || "—"}</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      {showDeleted ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => restoreMutation.mutate({ id: v.id })}
                          disabled={restoreMutation.isPending}
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />
                          Restore
                        </Button>
                      ) : (
                        <>
                          <Link href={`/vendors/${v.id}/ledger`}>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Ledger">
                              <BookOpen className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(v)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("Move to trash?")) deleteMutation.mutate({ id: v.id }); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogHeader><DialogTitle>{editId ? "Edit" : "New"} Vendor</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>GSTIN</Label>
              <Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>PAN</Label>
              <Input value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Address</Label>
            <Input value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>State</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.state} onChange={(e) => {
                const st = INDIAN_STATES.find((s) => s.code === e.target.value);
                setForm({ ...form, state: e.target.value, stateName: st?.name ?? "" });
              }}>
                <option value="">Select...</option>
                {INDIAN_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Pincode</Label>
              <Input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Contact Name</Label>
              <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
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
