"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INDIAN_STATES } from "@/lib/constants";
import { Save, Loader2, RefreshCw, CheckCircle2, XCircle, Clock } from "lucide-react";

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
    name: "", legalName: "", gstin: "", pan: "",
    addressLine1: "", addressLine2: "", city: "", state: "", stateName: "", pincode: "",
    phone: "", email: "", website: "",
    bankName: "", bankAccountNo: "", bankIfsc: "", bankBranch: "", bankUpiId: "",
    invoicePrefix: "", quotePrefix: "", defaultTerms: "", defaultPaymentTermsDays: 30,
  });

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name ?? "", legalName: company.legalName ?? "", gstin: company.gstin ?? "", pan: company.pan ?? "",
        addressLine1: company.addressLine1 ?? "", addressLine2: company.addressLine2 ?? "",
        city: company.city ?? "", state: company.state ?? "", stateName: company.stateName ?? "", pincode: company.pincode ?? "",
        phone: company.phone ?? "", email: company.email ?? "", website: company.website ?? "",
        bankName: company.bankName ?? "", bankAccountNo: company.bankAccountNo ?? "",
        bankIfsc: company.bankIfsc ?? "", bankBranch: company.bankBranch ?? "", bankUpiId: company.bankUpiId ?? "",
        invoicePrefix: company.invoicePrefix ?? "", quotePrefix: company.quotePrefix ?? "",
        defaultTerms: company.defaultTerms ?? "", defaultPaymentTermsDays: company.defaultPaymentTermsDays ?? 30,
      });
    }
  }, [company]);

  function handleChange(field: string, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "state") {
      const stateObj = INDIAN_STATES.find((s) => s.code === value);
      if (stateObj) setForm((prev) => ({ ...prev, stateName: stateObj.name }));
    }
  }

  function handleSave() {
    if (!activeCompanyId) return;
    updateMutation.mutate({ id: activeCompanyId, ...form });
  }

  if (!activeCompanyId) return <div className="flex items-center justify-center h-64"><p className="text-sm text-gray-500">Select a company first.</p></div>;
  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Company Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your company details, address, and bank information.</p>
        </div>
        <Button size="sm" className="h-9 bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          {saved ? "Saved!" : "Save Changes"}
        </Button>
      </div>

      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Company Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Company Name</Label><Input value={form.name} onChange={(e) => handleChange("name", e.target.value)} className="h-9 bg-gray-50 border-gray-200" /></div>
          <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Legal Name (as on GST)</Label><Input value={form.legalName} onChange={(e) => handleChange("legalName", e.target.value)} className="h-9 bg-gray-50 border-gray-200" /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">GSTIN</Label><Input value={form.gstin} onChange={(e) => handleChange("gstin", e.target.value.toUpperCase())} maxLength={15} className="h-9 bg-gray-50 border-gray-200 font-mono" /></div>
          <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">PAN</Label><Input value={form.pan} onChange={(e) => handleChange("pan", e.target.value.toUpperCase())} maxLength={10} className="h-9 bg-gray-50 border-gray-200 font-mono" /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Phone</Label><Input value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} className="h-9 bg-gray-50 border-gray-200" /></div>
          <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Email</Label><Input type="email" value={form.email} onChange={(e) => handleChange("email", e.target.value)} className="h-9 bg-gray-50 border-gray-200" /></div>
        </div>
        <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Website</Label><Input value={form.website} onChange={(e) => handleChange("website", e.target.value)} className="h-9 bg-gray-50 border-gray-200" /></div>
      </div>

      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Address</h2>
        <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Address Line 1</Label><Input value={form.addressLine1} onChange={(e) => handleChange("addressLine1", e.target.value)} className="h-9 bg-gray-50 border-gray-200" /></div>
        <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Address Line 2</Label><Input value={form.addressLine2} onChange={(e) => handleChange("addressLine2", e.target.value)} className="h-9 bg-gray-50 border-gray-200" /></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">City</Label><Input value={form.city} onChange={(e) => handleChange("city", e.target.value)} className="h-9 bg-gray-50 border-gray-200" /></div>
          <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">State</Label><select className="flex h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.state} onChange={(e) => handleChange("state", e.target.value)}><option value="">Select...</option>{INDIAN_STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</select></div>
          <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Pincode</Label><Input value={form.pincode} onChange={(e) => handleChange("pincode", e.target.value)} maxLength={6} className="h-9 bg-gray-50 border-gray-200" /></div>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Bank Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Bank Name</Label><Input value={form.bankName} onChange={(e) => handleChange("bankName", e.target.value)} className="h-9 bg-gray-50 border-gray-200" /></div>
          <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Branch</Label><Input value={form.bankBranch} onChange={(e) => handleChange("bankBranch", e.target.value)} className="h-9 bg-gray-50 border-gray-200" /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Account Number</Label><Input value={form.bankAccountNo} onChange={(e) => handleChange("bankAccountNo", e.target.value)} className="h-9 bg-gray-50 border-gray-200 font-mono" /></div>
          <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">IFSC Code</Label><Input value={form.bankIfsc} onChange={(e) => handleChange("bankIfsc", e.target.value.toUpperCase())} className="h-9 bg-gray-50 border-gray-200 font-mono" /></div>
        </div>
        <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">UPI ID</Label><Input value={form.bankUpiId} onChange={(e) => handleChange("bankUpiId", e.target.value)} className="h-9 bg-gray-50 border-gray-200" /></div>
      </div>

      <div className="bg-white rounded-lg border p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Invoice Settings</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Invoice Prefix</Label><Input value={form.invoicePrefix} onChange={(e) => handleChange("invoicePrefix", e.target.value)} className="h-9 bg-gray-50 border-gray-200 font-mono" /></div>
          <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Quote Prefix</Label><Input value={form.quotePrefix} onChange={(e) => handleChange("quotePrefix", e.target.value)} className="h-9 bg-gray-50 border-gray-200 font-mono" /></div>
          <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Payment Terms (days)</Label><Input type="number" value={form.defaultPaymentTermsDays} onChange={(e) => handleChange("defaultPaymentTermsDays", parseInt(e.target.value) || 0)} className="h-9 bg-gray-50 border-gray-200" /></div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">Default Terms & Notes</Label>
          <textarea className="flex w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm min-h-[100px] focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.defaultTerms} onChange={(e) => handleChange("defaultTerms", e.target.value)} />
        </div>
      </div>

      <div className="flex justify-end pb-2">
        <Button size="sm" className="h-9 bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          {saved ? "Saved!" : "Save Changes"}
        </Button>
      </div>

      <GoogleSheetsSyncCard companyId={activeCompanyId} />
    </div>
  );
}

function GoogleSheetsSyncCard({ companyId }: { companyId: string }) {
  const utils = trpc.useUtils();
  const { data: config } = trpc.googleSheets.getConfig.useQuery({ companyId }, { enabled: !!companyId });
  const { data: lastSync } = trpc.googleSheets.getLastSync.useQuery({ companyId }, { enabled: !!companyId });

  const saveConfigMutation = trpc.googleSheets.saveConfig.useMutation({
    onSuccess: () => { utils.googleSheets.getConfig.invalidate(); setSyncSaved(true); setTimeout(() => setSyncSaved(false), 2000); },
  });
  const syncNowMutation = trpc.googleSheets.syncNow.useMutation({
    onSuccess: () => utils.googleSheets.getLastSync.invalidate(),
  });

  const [syncSaved, setSyncSaved] = useState(false);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  /** Save config first, then trigger sync — ensures DB is up-to-date before sync reads it */
  const handleSyncNow = async () => {
    if (!spreadsheetUrl) return;
    setIsSyncing(true);
    try {
      await saveConfigMutation.mutateAsync({ companyId, spreadsheetUrl, apiKey, enabled: true });
      await syncNowMutation.mutateAsync({ companyId });
    } catch {
      // errors are shown via syncNowMutation.data or saveConfigMutation.error
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (config && !initialized) {
      setSpreadsheetUrl(config.spreadsheetId || "");
      setApiKey(config.apiKey || "");
      setEnabled(config.enabled || false);
      setInitialized(true);
    }
  }, [config, initialized]);

  return (
    <div className="bg-white rounded-lg border p-6 space-y-4">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-2"><RefreshCw className="h-4 w-4" />Google Sheets Sync</h2>
        <p className="text-xs text-gray-400 mt-1">Automatically sync invoices and vendor bills from Google Sheets. Syncs at 8 AM & 6 PM daily when enabled.</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">Google Sheet URL or Spreadsheet ID</Label>
        <Input value={spreadsheetUrl} onChange={(e) => setSpreadsheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." className="h-9 bg-gray-50 border-gray-200" />
        <p className="text-xs text-gray-400">The sheet must be shared as &quot;Anyone with the link can view&quot;.</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">Google API Key (optional)</Label>
        <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} type="password" placeholder="AIza..." className="h-9 bg-gray-50 border-gray-200" />
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
          <span className="text-sm font-medium text-gray-700">Enable automatic sync</span>
        </label>
        {enabled && <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-green-100 text-green-700"><Clock className="h-3 w-3 mr-1" />8 AM & 6 PM daily</span>}
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" className="h-9" onClick={() => saveConfigMutation.mutate({ companyId, spreadsheetUrl, apiKey, enabled })} disabled={saveConfigMutation.isPending}>
          {saveConfigMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          {syncSaved ? "Saved!" : "Save Config"}
        </Button>
        <Button size="sm" className="h-9 bg-blue-600 hover:bg-blue-700" onClick={handleSyncNow} disabled={isSyncing || !spreadsheetUrl}>
          {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Sync Now
        </Button>
      </div>

      {saveConfigMutation.error && !syncNowMutation.data && (
        <div className="rounded-lg border p-3 text-sm bg-red-50 border-red-200">
          <div className="flex items-center gap-1 text-red-800"><XCircle className="h-4 w-4" />{saveConfigMutation.error.message}</div>
        </div>
      )}

      {syncNowMutation.data && (
        <div className={`rounded-lg border p-3 text-sm ${syncNowMutation.data.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
          {syncNowMutation.data.success ? (
            <div className="space-y-1">
              <div className="flex items-center gap-1 font-medium text-green-800"><CheckCircle2 className="h-4 w-4" />Sync completed in {syncNowMutation.data.durationMs}ms</div>
              {syncNowMutation.data.result && (
                <div className="text-green-700 space-y-0.5 text-xs">
                  {syncNowMutation.data.result.sheetNames && <p className="text-gray-500">Sheets: {syncNowMutation.data.result.sheetNames.join(", ")}</p>}
                  {syncNowMutation.data.result.totalRowsParsed !== undefined && <p>Total rows parsed: {syncNowMutation.data.result.totalRowsParsed}</p>}
                  <p>Invoices: {syncNowMutation.data.result.invoicesCreated} created, {syncNowMutation.data.result.invoicesUpdated} updated, {syncNowMutation.data.result.invoicesSkipped} skipped</p>
                  <p>Bills: {syncNowMutation.data.result.billsCreated} created, {syncNowMutation.data.result.billsUpdated} updated, {syncNowMutation.data.result.billsSkipped} skipped</p>
                  {syncNowMutation.data.result.customersCreated > 0 && <p>New customers: {syncNowMutation.data.result.customersCreated}</p>}
                  {syncNowMutation.data.result.vendorsCreated > 0 && <p>New vendors: {syncNowMutation.data.result.vendorsCreated}</p>}
                  {syncNowMutation.data.result.errors.length > 0 && (
                    <details className="text-amber-700">
                      <summary className="cursor-pointer font-medium">{syncNowMutation.data.result.errors.length} warnings</summary>
                      <ul className="mt-1 list-disc pl-4 space-y-0.5">
                        {syncNowMutation.data.result.errors.slice(0, 20).map((e, i) => <li key={i}>{e}</li>)}
                        {syncNowMutation.data.result.errors.length > 20 && <li>...and {syncNowMutation.data.result.errors.length - 20} more</li>}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1 text-red-800"><XCircle className="h-4 w-4" />{syncNowMutation.data.error}</div>
          )}
        </div>
      )}

      {lastSync && !syncNowMutation.data && (
        <div className="rounded-lg border bg-gray-50 p-3 text-sm">
          <div className="flex items-center gap-2 mb-1">
            {lastSync.success ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
            <span className="font-medium text-gray-700">Last sync: {new Date(lastSync.timestamp).toLocaleString()}</span>
          </div>
          {lastSync.success && lastSync.result && (
            <p className="text-gray-500 text-xs">{lastSync.result.invoicesCreated + lastSync.result.invoicesUpdated} invoices, {lastSync.result.billsCreated + lastSync.result.billsUpdated} bills processed ({lastSync.durationMs}ms)</p>
          )}
          {!lastSync.success && lastSync.error && <p className="text-red-600 text-xs">{lastSync.error}</p>}
        </div>
      )}
    </div>
  );
}
