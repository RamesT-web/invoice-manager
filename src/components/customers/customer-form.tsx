"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INDIAN_STATES } from "@/lib/constants";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import Link from "next/link";

interface CustomerFormProps {
  customerId?: string;
}

export function CustomerForm({ customerId }: CustomerFormProps) {
  const router = useRouter();
  const { activeCompanyId } = useCompanyStore();
  const utils = trpc.useUtils();
  const isEdit = !!customerId;

  const { data: existing } = trpc.customer.get.useQuery(
    { id: customerId! },
    { enabled: isEdit }
  );

  const [form, setForm] = useState<Record<string, string | number | null>>({});
  const [initialized, setInitialized] = useState(false);

  if (isEdit && existing && !initialized) {
    setForm({
      name: existing.name, gstin: existing.gstin, pan: existing.pan,
      billingAddressLine1: existing.billingAddressLine1, billingAddressLine2: existing.billingAddressLine2,
      billingCity: existing.billingCity, billingState: existing.billingState,
      billingStateName: existing.billingStateName, billingPincode: existing.billingPincode,
      contactName: existing.contactName, contactEmail: existing.contactEmail,
      contactPhone: existing.contactPhone, contactWhatsapp: existing.contactWhatsapp,
      paymentTermsDays: existing.paymentTermsDays, notes: existing.notes,
    });
    setInitialized(true);
  }

  const createMutation = trpc.customer.create.useMutation({ onSuccess: () => { utils.customer.list.invalidate(); router.push("/customers"); } });
  const updateMutation = trpc.customer.update.useMutation({ onSuccess: () => { utils.customer.list.invalidate(); router.push("/customers"); } });
  const isPending = createMutation.isPending || updateMutation.isPending;

  function set(field: string, value: string | number | null) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "billingState") {
      const st = INDIAN_STATES.find((s) => s.code === value);
      if (st) setForm((prev) => ({ ...prev, billingStateName: st.name }));
    }
  }
  function val(field: string): string { return (form[field] as string) ?? ""; }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCompanyId) return;
    const data = {
      name: val("name"), gstin: val("gstin") || null, pan: val("pan") || null,
      billingAddressLine1: val("billingAddressLine1") || null, billingAddressLine2: val("billingAddressLine2") || null,
      billingCity: val("billingCity") || null, billingState: val("billingState") || null,
      billingStateName: val("billingStateName") || null, billingPincode: val("billingPincode") || null,
      contactName: val("contactName") || null, contactEmail: val("contactEmail") || null,
      contactPhone: val("contactPhone") || null, contactWhatsapp: val("contactWhatsapp") || null,
      paymentTermsDays: form.paymentTermsDays ? Number(form.paymentTermsDays) : null, notes: val("notes") || null,
    };
    if (isEdit) updateMutation.mutate({ id: customerId!, ...data });
    else createMutation.mutate({ companyId: activeCompanyId, ...data });
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/customers"><Button variant="ghost" size="icon" className="h-9 w-9"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-xl font-semibold text-gray-900">{isEdit ? "Edit Customer" : "New Customer"}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Company Details</h2>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-gray-700">Company / Customer Name *</Label>
            <Input value={val("name")} onChange={(e) => set("name", e.target.value)} required className="h-9 bg-gray-50 border-gray-200" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">GSTIN</Label><Input value={val("gstin")} onChange={(e) => set("gstin", e.target.value.toUpperCase())} maxLength={15} placeholder="33AABCA1234F1ZP" className="h-9 bg-gray-50 border-gray-200 font-mono" /></div>
            <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">PAN</Label><Input value={val("pan")} onChange={(e) => set("pan", e.target.value.toUpperCase())} maxLength={10} className="h-9 bg-gray-50 border-gray-200 font-mono" /></div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Billing Address</h2>
          <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Address Line 1</Label><Input value={val("billingAddressLine1")} onChange={(e) => set("billingAddressLine1", e.target.value)} className="h-9 bg-gray-50 border-gray-200" /></div>
          <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Address Line 2</Label><Input value={val("billingAddressLine2")} onChange={(e) => set("billingAddressLine2", e.target.value)} className="h-9 bg-gray-50 border-gray-200" /></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">City</Label><Input value={val("billingCity")} onChange={(e) => set("billingCity", e.target.value)} className="h-9 bg-gray-50 border-gray-200" /></div>
            <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">State</Label><select className="flex h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={val("billingState")} onChange={(e) => set("billingState", e.target.value)}><option value="">Select</option>{INDIAN_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</select></div>
            <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Pincode</Label><Input value={val("billingPincode")} onChange={(e) => set("billingPincode", e.target.value)} maxLength={6} className="h-9 bg-gray-50 border-gray-200" /></div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Contact</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Contact Person</Label><Input value={val("contactName")} onChange={(e) => set("contactName", e.target.value)} className="h-9 bg-gray-50 border-gray-200" /></div>
            <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Email</Label><Input type="email" value={val("contactEmail")} onChange={(e) => set("contactEmail", e.target.value)} className="h-9 bg-gray-50 border-gray-200" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Phone</Label><Input value={val("contactPhone")} onChange={(e) => set("contactPhone", e.target.value)} className="h-9 bg-gray-50 border-gray-200" /></div>
            <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">WhatsApp</Label><Input value={val("contactWhatsapp")} onChange={(e) => set("contactWhatsapp", e.target.value)} className="h-9 bg-gray-50 border-gray-200" /></div>
          </div>
          <div className="space-y-1.5 max-w-[200px]">
            <Label className="text-sm font-medium text-gray-700">Payment Terms (days)</Label>
            <Input type="number" value={val("paymentTermsDays")} onChange={(e) => set("paymentTermsDays", e.target.value ? parseInt(e.target.value) : null)} className="h-9 bg-gray-50 border-gray-200" />
          </div>
        </div>

        <div className="flex justify-end gap-3 pb-6">
          <Link href="/customers"><Button type="button" variant="outline" className="h-9">Cancel</Button></Link>
          <Button type="submit" className="h-9 bg-blue-600 hover:bg-blue-700" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {isEdit ? "Update" : "Create"} Customer
          </Button>
        </div>
      </form>
    </div>
  );
}
