"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { INDIAN_STATES } from "@/lib/constants";
import { Building2, Save, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const { activeCompanyId } = useCompanyStore();
  const utils = trpc.useUtils();

  const { data: company, isLoading } = trpc.company.get.useQuery(
    { id: activeCompanyId! },
    { enabled: !!activeCompanyId }
  );

  const updateMutation = trpc.company.update.useMutation({
    onSuccess: () => {
      utils.company.get.invalidate();
      utils.company.list.invalidate();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: "",
    legalName: "",
    gstin: "",
    pan: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    stateName: "",
    pincode: "",
    phone: "",
    email: "",
    website: "",
    bankName: "",
    bankAccountNo: "",
    bankIfsc: "",
    bankBranch: "",
    bankUpiId: "",
    invoicePrefix: "",
    quotePrefix: "",
    defaultTerms: "",
    defaultPaymentTermsDays: 30,
  });

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name ?? "",
        legalName: company.legalName ?? "",
        gstin: company.gstin ?? "",
        pan: company.pan ?? "",
        addressLine1: company.addressLine1 ?? "",
        addressLine2: company.addressLine2 ?? "",
        city: company.city ?? "",
        state: company.state ?? "",
        stateName: company.stateName ?? "",
        pincode: company.pincode ?? "",
        phone: company.phone ?? "",
        email: company.email ?? "",
        website: company.website ?? "",
        bankName: company.bankName ?? "",
        bankAccountNo: company.bankAccountNo ?? "",
        bankIfsc: company.bankIfsc ?? "",
        bankBranch: company.bankBranch ?? "",
        bankUpiId: company.bankUpiId ?? "",
        invoicePrefix: company.invoicePrefix ?? "",
        quotePrefix: company.quotePrefix ?? "",
        defaultTerms: company.defaultTerms ?? "",
        defaultPaymentTermsDays: company.defaultPaymentTermsDays ?? 30,
      });
    }
  }, [company]);

  function handleChange(field: string, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));

    // Auto-fill state name when state code changes
    if (field === "state") {
      const stateObj = INDIAN_STATES.find((s) => s.code === value);
      if (stateObj) {
        setForm((prev) => ({ ...prev, stateName: stateObj.name }));
      }
    }
  }

  function handleSave() {
    if (!activeCompanyId) return;
    updateMutation.mutate({
      id: activeCompanyId,
      ...form,
    });
  }

  if (!activeCompanyId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Select a company first.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Company Settings</h1>
          <p className="text-muted-foreground text-sm">
            Manage your company details, address, and bank information.
          </p>
        </div>
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {saved ? "Saved!" : "Save Changes"}
        </Button>
      </div>

      {/* Company Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Details
          </CardTitle>
          <CardDescription>Basic information about your company</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="TES Engineering"
              />
            </div>
            <div className="space-y-2">
              <Label>Legal Name (as on GST)</Label>
              <Input
                value={form.legalName}
                onChange={(e) => handleChange("legalName", e.target.value)}
                placeholder="TES Engineering Services"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>GSTIN</Label>
              <Input
                value={form.gstin}
                onChange={(e) => handleChange("gstin", e.target.value.toUpperCase())}
                placeholder="33AABCT1234F1ZP"
                maxLength={15}
              />
            </div>
            <div className="space-y-2">
              <Label>PAN</Label>
              <Input
                value={form.pan}
                onChange={(e) => handleChange("pan", e.target.value.toUpperCase())}
                placeholder="AABCT1234F"
                maxLength={10}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="accounts@company.com"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Website</Label>
            <Input
              value={form.website}
              onChange={(e) => handleChange("website", e.target.value)}
              placeholder="https://www.company.com"
            />
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Address</CardTitle>
          <CardDescription>This appears on your invoices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Address Line 1</Label>
            <Input
              value={form.addressLine1}
              onChange={(e) => handleChange("addressLine1", e.target.value)}
              placeholder="123 Business Street"
            />
          </div>
          <div className="space-y-2">
            <Label>Address Line 2</Label>
            <Input
              value={form.addressLine2}
              onChange={(e) => handleChange("addressLine2", e.target.value)}
              placeholder="Suite 456"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>City</Label>
              <Input
                value={form.city}
                onChange={(e) => handleChange("city", e.target.value)}
                placeholder="Chennai"
              />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.state}
                onChange={(e) => handleChange("state", e.target.value)}
              >
                <option value="">Select State</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Pincode</Label>
              <Input
                value={form.pincode}
                onChange={(e) => handleChange("pincode", e.target.value)}
                placeholder="600001"
                maxLength={6}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bank Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Bank Details</CardTitle>
          <CardDescription>Shown on invoices for payment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Bank Name</Label>
              <Input
                value={form.bankName}
                onChange={(e) => handleChange("bankName", e.target.value)}
                placeholder="State Bank of India"
              />
            </div>
            <div className="space-y-2">
              <Label>Branch</Label>
              <Input
                value={form.bankBranch}
                onChange={(e) => handleChange("bankBranch", e.target.value)}
                placeholder="Anna Nagar Branch"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Account Number</Label>
              <Input
                value={form.bankAccountNo}
                onChange={(e) => handleChange("bankAccountNo", e.target.value)}
                placeholder="1234567890"
              />
            </div>
            <div className="space-y-2">
              <Label>IFSC Code</Label>
              <Input
                value={form.bankIfsc}
                onChange={(e) => handleChange("bankIfsc", e.target.value.toUpperCase())}
                placeholder="SBIN0001234"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>UPI ID</Label>
            <Input
              value={form.bankUpiId}
              onChange={(e) => handleChange("bankUpiId", e.target.value)}
              placeholder="company@upi"
            />
          </div>
        </CardContent>
      </Card>

      {/* Invoice Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Invoice Settings</CardTitle>
          <CardDescription>Prefixes and default values</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Invoice Prefix</Label>
              <Input
                value={form.invoicePrefix}
                onChange={(e) => handleChange("invoicePrefix", e.target.value)}
                placeholder="TES/"
              />
            </div>
            <div className="space-y-2">
              <Label>Quote Prefix</Label>
              <Input
                value={form.quotePrefix}
                onChange={(e) => handleChange("quotePrefix", e.target.value)}
                placeholder="QT/"
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Terms (days)</Label>
              <Input
                type="number"
                value={form.defaultPaymentTermsDays}
                onChange={(e) =>
                  handleChange("defaultPaymentTermsDays", parseInt(e.target.value) || 0)
                }
                placeholder="30"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Default Terms & Notes</Label>
            <textarea
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px]"
              value={form.defaultTerms}
              onChange={(e) => handleChange("defaultTerms", e.target.value)}
              placeholder="Payment is due within 30 days of invoice date. Late payments may attract interest at 18% per annum."
            />
          </div>
        </CardContent>
      </Card>

      {/* Bottom save button */}
      <div className="flex justify-end pb-6">
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {saved ? "Saved!" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
