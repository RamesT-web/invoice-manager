"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  // Initialize form when editing
  if (isEdit && existing && !initialized) {
    setForm({
      name: existing.name,
      gstin: existing.gstin,
      pan: existing.pan,
      billingAddressLine1: existing.billingAddressLine1,
      billingAddressLine2: existing.billingAddressLine2,
      billingCity: existing.billingCity,
      billingState: existing.billingState,
      billingStateName: existing.billingStateName,
      billingPincode: existing.billingPincode,
      contactName: existing.contactName,
      contactEmail: existing.contactEmail,
      contactPhone: existing.contactPhone,
      contactWhatsapp: existing.contactWhatsapp,
      paymentTermsDays: existing.paymentTermsDays,
      notes: existing.notes,
    });
    setInitialized(true);
  }

  const createMutation = trpc.customer.create.useMutation({
    onSuccess: () => {
      utils.customer.list.invalidate();
      router.push("/customers");
    },
  });

  const updateMutation = trpc.customer.update.useMutation({
    onSuccess: () => {
      utils.customer.list.invalidate();
      router.push("/customers");
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function set(field: string, value: string | number | null) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "billingState") {
      const st = INDIAN_STATES.find((s) => s.code === value);
      if (st) setForm((prev) => ({ ...prev, billingStateName: st.name }));
    }
  }

  function val(field: string): string {
    return (form[field] as string) ?? "";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCompanyId) return;

    const data = {
      name: val("name"),
      gstin: val("gstin") || null,
      pan: val("pan") || null,
      billingAddressLine1: val("billingAddressLine1") || null,
      billingAddressLine2: val("billingAddressLine2") || null,
      billingCity: val("billingCity") || null,
      billingState: val("billingState") || null,
      billingStateName: val("billingStateName") || null,
      billingPincode: val("billingPincode") || null,
      contactName: val("contactName") || null,
      contactEmail: val("contactEmail") || null,
      contactPhone: val("contactPhone") || null,
      contactWhatsapp: val("contactWhatsapp") || null,
      paymentTermsDays: form.paymentTermsDays ? Number(form.paymentTermsDays) : null,
      notes: val("notes") || null,
    };

    if (isEdit) {
      updateMutation.mutate({ id: customerId!, ...data });
    } else {
      createMutation.mutate({ companyId: activeCompanyId, ...data });
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/customers">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">
          {isEdit ? "Edit Customer" : "New Customer"}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-lg">Company Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Company / Customer Name *</Label>
              <Input value={val("name")} onChange={(e) => set("name", e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>GSTIN</Label>
                <Input value={val("gstin")} onChange={(e) => set("gstin", e.target.value.toUpperCase())} maxLength={15} placeholder="33AABCA1234F1ZP" />
              </div>
              <div className="space-y-1">
                <Label>PAN</Label>
                <Input value={val("pan")} onChange={(e) => set("pan", e.target.value.toUpperCase())} maxLength={10} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Billing Address</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Address Line 1</Label>
              <Input value={val("billingAddressLine1")} onChange={(e) => set("billingAddressLine1", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Address Line 2</Label>
              <Input value={val("billingAddressLine2")} onChange={(e) => set("billingAddressLine2", e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>City</Label>
                <Input value={val("billingCity")} onChange={(e) => set("billingCity", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>State</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={val("billingState")} onChange={(e) => set("billingState", e.target.value)}>
                  <option value="">Select</option>
                  {INDIAN_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Pincode</Label>
                <Input value={val("billingPincode")} onChange={(e) => set("billingPincode", e.target.value)} maxLength={6} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Contact</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Contact Person</Label>
                <Input value={val("contactName")} onChange={(e) => set("contactName", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={val("contactEmail")} onChange={(e) => set("contactEmail", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={val("contactPhone")} onChange={(e) => set("contactPhone", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>WhatsApp</Label>
                <Input value={val("contactWhatsapp")} onChange={(e) => set("contactWhatsapp", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1 max-w-[200px]">
              <Label>Payment Terms (days)</Label>
              <Input type="number" value={val("paymentTermsDays")} onChange={(e) => set("paymentTermsDays", e.target.value ? parseInt(e.target.value) : null)} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/customers"><Button type="button" variant="outline">Cancel</Button></Link>
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {isEdit ? "Update" : "Create"} Customer
          </Button>
        </div>
      </form>
    </div>
  );
}
