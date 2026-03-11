"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { INDIAN_STATES } from "@/lib/constants";
import { Plus, Search, Pencil, Trash2, Loader2, Save, RotateCcw, BookOpen, Package } from "lucide-react";
import Link from "next/link";

interface VendorForm {
  name: string; gstin: string; pan: string; addressLine1: string; city: string;
  state: string; stateName: string; pincode: string; contactName: string;
  contactEmail: string; contactPhone: string; paymentTermsDays: number | null; notes: string;
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
  const debouncedSearch = useDebounce(search);
  const utils = trpc.useUtils();

  const { data: vendors, isLoading } = trpc.vendor.list.useQuery(
    { companyId: activeCompanyId!, search: debouncedSearch || undefined, showDeleted },
    { enabled: !!activeCompanyId }
  );

  const createMutation = trpc.vendor.create.useMutation({ onSuccess: () => { utils.vendor.list.invalidate(); setDialogOpen(false); } });
  const updateMutation = trpc.vendor.update.useMutation({ onSuccess: () => { utils.vendor.list.invalidate(); setDialogOpen(false); } });
  const deleteMutation = trpc.vendor.delete.useMutation({ onSuccess: () => utils.vendor.list.invalidate() });
  const restoreMutation = trpc.vendor.restore.useMutation({ onSuccess: () => utils.vendor.list.invalidate() });
  const isPending = createMutation.isPending || updateMutation.isPending;

  function openNew() { setEditId(null); setForm(emptyForm); setDialogOpen(true); }

  function openEdit(v: { id: string; name: string; gstin: string | null; pan: string | null; addressLine1: string | null; city: string | null; state: string | null; stateName: string | null; pincode: string | null; contactName: string | null; contactEmail: string | null; contactPhone: string | null; paymentTermsDays: number | null; notes: string | null }) {
    setEditId(v.id);
    setForm({ name: v.name, gstin: v.gstin ?? "", pan: v.pan ?? "", addressLine1: v.addressLine1 ?? "", city: v.city ?? "", state: v.state ?? "", stateName: v.stateName ?? "", pincode: v.pincode ?? "", contactName: v.contactName ?? "", contactEmail: v.contactEmail ?? "", contactPhone: v.contactPhone ?? "", paymentTermsDays: v.paymentTermsDays, notes: v.notes ?? "" });
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCompanyId) return;
    const data = { ...form, gstin: form.gstin || null, pan: form.pan || null, addressLine1: form.addressLine1 || null, city: form.city || null, state: form.state || null, stateName: form.stateName || null, pincode: form.pincode || null, contactName: form.contactName || null, contactEmail: form.contactEmail || null, contactPhone: form.contactPhone || null, notes: form.notes || null };
    if (editId) updateMutation.mutate({ id: editId, ...data });
    else createMutation.mutate({ companyId: activeCompanyId, ...data });
  }

  if (!activeCompanyId) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Vendors</h1>
        <div className="flex items-center gap-2">
          <Button variant={showDeleted ? "default" : "outline"} size="sm" className="h-9" onClick={() => setShowDeleted(!showDeleted)}>
            <Trash2 className="h-4 w-4 mr-1.5" />{showDeleted ? "Viewing Trash" : "Trash"}
          </Button>
          {!showDeleted && <Button size="sm" className="h-9 bg-blue-600 hover:bg-blue-700" onClick={openNew}><Plus className="h-4 w-4 mr-1.5" />Add Vendor</Button>}
        </div>
      </div>

      <div className="bg-white rounded-lg border p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search vendors..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 bg-gray-50 border-gray-200" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : !vendors?.length ? (
        <div className="bg-white rounded-lg border">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-gray-50 flex items-center justify-center mb-4"><Package className="h-8 w-8 text-gray-300" /></div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">{showDeleted ? "No deleted vendors" : "No vendors yet"}</h2>
            <p className="text-sm text-gray-500">{showDeleted ? "Deleted vendors will appear here." : "Add your first vendor to get started."}</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="data-table">
            <thead><tr><th>Name</th><th className="hidden sm:table-cell">GSTIN</th><th className="hidden md:table-cell">Contact</th><th className="text-right w-32">Actions</th></tr></thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id}>
                  <td>
                    <div className="font-medium text-gray-900">{v.name}</div>
                    {v.city && <div className="text-xs text-gray-400 mt-0.5">{v.city}{v.stateName ? `, ${v.stateName}` : ""}</div>}
                  </td>
                  <td className="hidden sm:table-cell text-gray-500 font-mono text-xs">{v.gstin || "\u2014"}</td>
                  <td className="hidden md:table-cell text-gray-500 text-xs">{v.contactEmail || v.contactPhone || "\u2014"}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-0.5">
                      {showDeleted ? (
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => restoreMutation.mutate({ id: v.id })} disabled={restoreMutation.isPending}><RotateCcw className="h-3 w-3 mr-1" />Restore</Button>
                      ) : (
                        <>
                          <Link href={`/vendors/${v.id}/ledger`}><Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-blue-600" title="Ledger"><BookOpen className="h-3.5 w-3.5" /></Button></Link>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-blue-600" onClick={() => openEdit(v)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500" onClick={() => { if (confirm("Move to trash?")) deleteMutation.mutate({ id: v.id }); }}><Trash2 className="h-3.5 w-3.5" /></Button>
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="h-9 bg-gray-50 border-gray-200" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">GSTIN</Label><Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} className="h-9 bg-gray-50 border-gray-200 font-mono" /></div>
            <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">PAN</Label><Input value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value })} className="h-9 bg-gray-50 border-gray-200 font-mono" /></div>
          </div>
          <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Address</Label><Input value={form.addressLine1} onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} className="h-9 bg-gray-50 border-gray-200" /></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="h-9 bg-gray-50 border-gray-200" /></div>
            <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">State</Label><select className="flex h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.state} onChange={(e) => { const st = INDIAN_STATES.find((s) => s.code === e.target.value); setForm({ ...form, state: e.target.value, stateName: st?.name ?? "" }); }}><option value="">Select...</option>{INDIAN_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</select></div>
            <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Pincode</Label><Input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} className="h-9 bg-gray-50 border-gray-200" /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Contact</Label><Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className="h-9 bg-gray-50 border-gray-200" /></div>
            <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Email</Label><Input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} className="h-9 bg-gray-50 border-gray-200" /></div>
            <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Phone</Label><Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} className="h-9 bg-gray-50 border-gray-200" /></div>
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
