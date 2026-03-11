"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Download, Loader2, Database, BarChart3 } from "lucide-react";

type ReportTab = "aging" | "tds" | "sales" | "vendor-gst";

function makeCsvString(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const csvLines = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((h) => {
        const val = row[h];
        const str = val instanceof Date ? formatDate(val) : String(val ?? "");
        return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(",")
    ),
  ];
  return csvLines.join("\n");
}

function downloadCsv(rows: Record<string, unknown>[], filename: string) {
  const csv = makeCsvString(rows);
  if (!csv) return;
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { activeCompanyId } = useCompanyStore();
  const [activeTab, setActiveTab] = useState<ReportTab>("aging");
  const [backupLoading, setBackupLoading] = useState(false);
  const utils = trpc.useUtils();

  const setBackupTimestamp = trpc.setting.set.useMutation({
    onSuccess: () => utils.setting.get.invalidate({ companyId: activeCompanyId!, key: "last_backup_at" }),
  });

  const { data: agingData, isLoading: agingLoading } = trpc.report.outstandingAging.useQuery(
    { companyId: activeCompanyId! },
    { enabled: !!activeCompanyId && activeTab === "aging" }
  );
  const { data: tdsData, isLoading: tdsLoading } = trpc.report.tdsRegister.useQuery(
    { companyId: activeCompanyId! },
    { enabled: !!activeCompanyId && activeTab === "tds" }
  );
  const { data: salesData, isLoading: salesLoading } = trpc.report.salesSummary.useQuery(
    { companyId: activeCompanyId! },
    { enabled: !!activeCompanyId && activeTab === "sales" }
  );
  const { data: vendorGstData, isLoading: vendorGstLoading } = trpc.report.vendorGstRegister.useQuery(
    { companyId: activeCompanyId! },
    { enabled: !!activeCompanyId && activeTab === "vendor-gst" }
  );

  const backupQuery = trpc.report.dataBackup.useQuery({ companyId: activeCompanyId! }, { enabled: false });
  const attachmentIndexQuery = trpc.attachment.backupIndex.useQuery({ companyId: activeCompanyId! }, { enabled: false });
  const storageDriverQuery = trpc.attachment.storageDriver.useQuery(undefined, { enabled: false });

  async function handleBackup() {
    setBackupLoading(true);
    try {
      const [backupResult, attResult, driverResult] = await Promise.all([
        backupQuery.refetch(), attachmentIndexQuery.refetch(), storageDriverQuery.refetch(),
      ]);
      const isObjectStorage = driverResult.data?.driver === "object";
      if (!backupResult.data) return;

      const { customers, vendors, invoices, vendorBills, payments } = backupResult.data;
      const attachments = attResult.data ?? [];

      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      if (customers.length > 0) zip.file("customers.csv", makeCsvString(customers.map((c) => ({ Name: c.name, GSTIN: c.gstin ?? "", PAN: c.pan ?? "", City: c.billingCity ?? "", State: c.billingStateName ?? "", Email: c.contactEmail ?? "", Phone: c.contactPhone ?? "" }))));
      if (vendors.length > 0) zip.file("vendors.csv", makeCsvString(vendors.map((v) => ({ Name: v.name, GSTIN: v.gstin ?? "", PAN: v.pan ?? "", City: v.city ?? "", State: v.stateName ?? "", Email: v.contactEmail ?? "", Phone: v.contactPhone ?? "" }))));
      if (invoices.length > 0) zip.file("invoices.csv", makeCsvString(invoices.map((inv) => ({ InvoiceNumber: inv.invoiceNumber, Customer: inv.customer.name, Date: formatDate(inv.invoiceDate), DueDate: formatDate(inv.dueDate), Status: inv.status, Total: Number(inv.totalAmount), Paid: Number(inv.amountPaid), Balance: Number(inv.balanceDue) }))));
      if (vendorBills.length > 0) zip.file("vendor_bills.csv", makeCsvString(vendorBills.map((b) => ({ BillNumber: b.billNumber, Vendor: b.vendor.name, Date: formatDate(b.billDate), DueDate: formatDate(b.dueDate), Status: b.status, Total: Number(b.totalAmount), Paid: Number(b.amountPaid), Balance: Number(b.balanceDue), GstFiled: b.gstFiled, GSTR2B: b.gstr2bReflected }))));
      if (payments.length > 0) zip.file("payments.csv", makeCsvString(payments.map((p) => ({ Date: formatDate(p.paymentDate), Type: p.type, Amount: Number(p.amount), Mode: p.paymentMode, Reference: p.referenceNumber ?? "", Invoice: p.invoice?.invoiceNumber ?? "", Customer: p.customer?.name ?? "", Vendor: p.vendor?.name ?? "", VendorBill: p.vendorBill?.billNumber ?? "" }))));

      if (attachments.length > 0) {
        zip.file("attachments_index.csv", makeCsvString(attachments.map((a) => ({ EntityType: a.entityType, EntityId: a.entityId, FileName: a.fileName, FileSize: a.fileSize, MimeType: a.mimeType, StoragePath: a.storagePath, UploadedAt: formatDate(a.createdAt), DownloadUrl: `/api/attachments/${a.id}` }))));
        if (!isObjectStorage) {
          const attFolder = zip.folder("attachments");
          if (attFolder) {
            for (const att of attachments) {
              try {
                const resp = await fetch(`/api/attachments/${att.id}`);
                if (resp.ok) { const blob = await resp.blob(); attFolder.file(`${att.entityType}_${att.entityId.slice(0, 8)}_${att.fileName}`, blob); }
              } catch { /* skip */ }
            }
          }
        }
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `data_backup_${new Date().toISOString().slice(0, 10)}.zip`; a.click();
      URL.revokeObjectURL(url);

      if (activeCompanyId) setBackupTimestamp.mutate({ companyId: activeCompanyId, key: "last_backup_at", value: new Date().toISOString() });
    } finally {
      setBackupLoading(false);
    }
  }

  if (!activeCompanyId) return null;

  const tabs: { key: ReportTab; label: string }[] = [
    { key: "aging", label: "Outstanding Aging" },
    { key: "tds", label: "TDS Register" },
    { key: "sales", label: "Sales Summary" },
    { key: "vendor-gst", label: "Vendor GST/2B" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Reports</h1>
        <Button variant="outline" size="sm" className="h-9" onClick={handleBackup} disabled={backupLoading}>
          {backupLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Database className="h-4 w-4 mr-2" />}
          Data Backup (ZIP)
        </Button>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <button key={t.key} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`} onClick={() => setActiveTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {activeTab === "aging" && (
        <div className="bg-white rounded-lg border">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-sm font-semibold text-gray-900">Outstanding Aging (Customer-wise)</h2>
            {agingData && agingData.length > 0 && (
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => downloadCsv(agingData.map((r) => ({ Invoice: r.invoiceNumber, Customer: r.customerName, InvoiceDate: formatDate(r.invoiceDate), DueDate: formatDate(r.dueDate), Total: r.totalAmount, BalanceDue: r.balanceDue, DaysOverdue: r.daysOverdue, Bucket: r.bucket })), "aging_report.csv")}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
            )}
          </div>
          <div className="p-4">
            {agingLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div> :
            !agingData?.length ? (
              <div className="flex flex-col items-center py-12 text-center">
                <div className="h-12 w-12 rounded-full bg-gray-50 flex items-center justify-center mb-3"><BarChart3 className="h-6 w-6 text-gray-300" /></div>
                <p className="text-sm text-gray-500">No outstanding invoices.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th>Invoice</th><th>Customer</th><th>Due Date</th><th className="text-right">Balance</th><th className="text-right">Days</th><th>Bucket</th></tr></thead>
                  <tbody>
                    {agingData.map((r, i) => (
                      <tr key={i}>
                        <td className="font-mono text-xs">{r.invoiceNumber}</td>
                        <td className="text-gray-900">{r.customerName}</td>
                        <td className="text-gray-500">{formatDate(r.dueDate)}</td>
                        <td className="text-right font-semibold tabular-nums">{formatCurrency(r.balanceDue)}</td>
                        <td className="text-right tabular-nums">{r.daysOverdue}</td>
                        <td><span className={`text-xs font-semibold ${r.bucket === "Current" ? "text-green-600" : r.bucket === "90+ days" ? "text-red-600" : "text-orange-600"}`}>{r.bucket}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "tds" && (
        <div className="bg-white rounded-lg border">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-sm font-semibold text-gray-900">TDS Register (Invoice-wise)</h2>
            {tdsData && tdsData.length > 0 && (
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => downloadCsv(tdsData.map((r) => ({ Invoice: r.invoiceNumber, Date: formatDate(r.invoiceDate), Customer: r.customerName, PAN: r.customerPan ?? "", Total: r.totalAmount, TDSRate: r.tdsRate + "%", TDSAmount: r.tdsAmount, CertStatus: r.certificateStatus, CertDate: r.certificateReceivedDate ? formatDate(r.certificateReceivedDate) : "" })), "tds_register.csv")}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
            )}
          </div>
          <div className="p-4">
            {tdsLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div> :
            !tdsData?.length ? (
              <div className="flex flex-col items-center py-12 text-center">
                <div className="h-12 w-12 rounded-full bg-gray-50 flex items-center justify-center mb-3"><BarChart3 className="h-6 w-6 text-gray-300" /></div>
                <p className="text-sm text-gray-500">No TDS entries.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>PAN</th><th className="text-right">Total</th><th className="text-right">TDS %</th><th className="text-right">TDS Amt</th><th>Cert Status</th></tr></thead>
                  <tbody>
                    {tdsData.map((r, i) => (
                      <tr key={i}>
                        <td className="font-mono text-xs">{r.invoiceNumber}</td>
                        <td className="text-gray-500">{formatDate(r.invoiceDate)}</td>
                        <td className="text-gray-900">{r.customerName}</td>
                        <td className="font-mono text-xs text-gray-500">{r.customerPan ?? "\u2014"}</td>
                        <td className="text-right tabular-nums">{formatCurrency(r.totalAmount)}</td>
                        <td className="text-right tabular-nums">{r.tdsRate}%</td>
                        <td className="text-right font-semibold tabular-nums">{formatCurrency(r.tdsAmount)}</td>
                        <td><span className={`text-xs font-semibold capitalize ${r.certificateStatus === "received" ? "text-green-600" : "text-orange-600"}`}>{r.certificateStatus}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "sales" && (
        <div className="bg-white rounded-lg border">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-sm font-semibold text-gray-900">Sales Summary (Month-wise)</h2>
            {salesData && salesData.length > 0 && (
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => downloadCsv(salesData.map((r) => ({ Month: r.month, Invoices: r.invoiceCount, Taxable: r.taxableAmount, CGST: r.cgst, SGST: r.sgst, IGST: r.igst, Total: r.totalAmount, Collected: r.collected })), "sales_summary.csv")}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
            )}
          </div>
          <div className="p-4">
            {salesLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div> :
            !salesData?.length ? (
              <div className="flex flex-col items-center py-12 text-center">
                <div className="h-12 w-12 rounded-full bg-gray-50 flex items-center justify-center mb-3"><BarChart3 className="h-6 w-6 text-gray-300" /></div>
                <p className="text-sm text-gray-500">No sales data.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th>Month</th><th className="text-right">Invoices</th><th className="text-right">Taxable</th><th className="text-right">CGST</th><th className="text-right">SGST</th><th className="text-right">IGST</th><th className="text-right">Total</th><th className="text-right">Collected</th></tr></thead>
                  <tbody>
                    {salesData.map((r, i) => (
                      <tr key={i}>
                        <td className="font-mono text-gray-900">{r.month}</td>
                        <td className="text-right tabular-nums">{r.invoiceCount}</td>
                        <td className="text-right tabular-nums">{formatCurrency(r.taxableAmount)}</td>
                        <td className="text-right tabular-nums">{formatCurrency(r.cgst)}</td>
                        <td className="text-right tabular-nums">{formatCurrency(r.sgst)}</td>
                        <td className="text-right tabular-nums">{formatCurrency(r.igst)}</td>
                        <td className="text-right font-semibold tabular-nums">{formatCurrency(r.totalAmount)}</td>
                        <td className="text-right text-green-600 tabular-nums">{formatCurrency(r.collected)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-900 font-semibold">
                      <td className="text-gray-900">Total</td>
                      <td className="text-right tabular-nums">{salesData.reduce((s, r) => s + r.invoiceCount, 0)}</td>
                      <td className="text-right tabular-nums">{formatCurrency(salesData.reduce((s, r) => s + r.taxableAmount, 0))}</td>
                      <td className="text-right tabular-nums">{formatCurrency(salesData.reduce((s, r) => s + r.cgst, 0))}</td>
                      <td className="text-right tabular-nums">{formatCurrency(salesData.reduce((s, r) => s + r.sgst, 0))}</td>
                      <td className="text-right tabular-nums">{formatCurrency(salesData.reduce((s, r) => s + r.igst, 0))}</td>
                      <td className="text-right tabular-nums">{formatCurrency(salesData.reduce((s, r) => s + r.totalAmount, 0))}</td>
                      <td className="text-right text-green-600 tabular-nums">{formatCurrency(salesData.reduce((s, r) => s + r.collected, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "vendor-gst" && (
        <div className="bg-white rounded-lg border">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-sm font-semibold text-gray-900">Vendor GST / GSTR-2B Register</h2>
            {vendorGstData && vendorGstData.length > 0 && (
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => downloadCsv(vendorGstData.map((r) => ({ Bill: r.billNumber, Date: formatDate(r.billDate), Vendor: r.vendorName, GSTIN: r.vendorGstin ?? "", Taxable: r.taxableAmount, CGST: r.cgst, SGST: r.sgst, IGST: r.igst, Total: r.totalAmount, GSTFiled: r.gstFiled ? "Yes" : "No", GSTR2B: r.gstr2bReflected ? "Yes" : "No", ITCEligible: r.itcEligible ? "Yes" : "No", PortalCheckDate: r.portalCheckDate ? formatDate(r.portalCheckDate) : "" })), "vendor_gst_register.csv")}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
            )}
          </div>
          <div className="p-4">
            {vendorGstLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div> :
            !vendorGstData?.length ? (
              <div className="flex flex-col items-center py-12 text-center">
                <div className="h-12 w-12 rounded-full bg-gray-50 flex items-center justify-center mb-3"><BarChart3 className="h-6 w-6 text-gray-300" /></div>
                <p className="text-sm text-gray-500">No vendor bills yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead><tr><th>Bill #</th><th>Vendor</th><th>GSTIN</th><th className="text-right">Total</th><th className="text-center">GST Filed</th><th className="text-center">2B</th><th className="text-center">ITC</th></tr></thead>
                  <tbody>
                    {vendorGstData.map((r, i) => (
                      <tr key={i}>
                        <td className="font-mono text-xs">{r.billNumber}</td>
                        <td className="text-gray-900">{r.vendorName}</td>
                        <td className="font-mono text-xs text-gray-500">{r.vendorGstin ?? "\u2014"}</td>
                        <td className="text-right font-semibold tabular-nums">{formatCurrency(r.totalAmount)}</td>
                        <td className="text-center"><span className={`text-xs font-semibold ${r.gstFiled ? "text-green-600" : "text-red-500"}`}>{r.gstFiled ? "Yes" : "No"}</span></td>
                        <td className="text-center"><span className={`text-xs font-semibold ${r.gstr2bReflected ? "text-green-600" : "text-red-500"}`}>{r.gstr2bReflected ? "Yes" : "No"}</span></td>
                        <td className="text-center"><span className={`text-xs font-semibold ${r.itcEligible ? "text-green-600" : "text-gray-400"}`}>{r.itcEligible ? "Yes" : "No"}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
