"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Download, Loader2, Database } from "lucide-react";

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

  const backupQuery = trpc.report.dataBackup.useQuery(
    { companyId: activeCompanyId! },
    { enabled: false }
  );
  const attachmentIndexQuery = trpc.attachment.backupIndex.useQuery(
    { companyId: activeCompanyId! },
    { enabled: false }
  );
  const storageDriverQuery = trpc.attachment.storageDriver.useQuery(
    undefined,
    { enabled: false }
  );

  async function handleBackup() {
    setBackupLoading(true);
    try {
      const [backupResult, attResult, driverResult] = await Promise.all([
        backupQuery.refetch(),
        attachmentIndexQuery.refetch(),
        storageDriverQuery.refetch(),
      ]);
      const isObjectStorage = driverResult.data?.driver === "object";
      if (!backupResult.data) return;

      const { customers, vendors, invoices, vendorBills, payments } = backupResult.data;
      const attachments = attResult.data ?? [];

      // Dynamically import JSZip
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      // Add CSV files
      if (customers.length > 0) {
        zip.file("customers.csv", makeCsvString(customers.map((c) => ({
          Name: c.name, GSTIN: c.gstin ?? "", PAN: c.pan ?? "", City: c.billingCity ?? "",
          State: c.billingStateName ?? "", Email: c.contactEmail ?? "", Phone: c.contactPhone ?? "",
        }))));
      }
      if (vendors.length > 0) {
        zip.file("vendors.csv", makeCsvString(vendors.map((v) => ({
          Name: v.name, GSTIN: v.gstin ?? "", PAN: v.pan ?? "", City: v.city ?? "",
          State: v.stateName ?? "", Email: v.contactEmail ?? "", Phone: v.contactPhone ?? "",
        }))));
      }
      if (invoices.length > 0) {
        zip.file("invoices.csv", makeCsvString(invoices.map((inv) => ({
          InvoiceNumber: inv.invoiceNumber, Customer: inv.customer.name,
          Date: formatDate(inv.invoiceDate), DueDate: formatDate(inv.dueDate),
          Status: inv.status, Total: Number(inv.totalAmount), Paid: Number(inv.amountPaid),
          Balance: Number(inv.balanceDue),
        }))));
      }
      if (vendorBills.length > 0) {
        zip.file("vendor_bills.csv", makeCsvString(vendorBills.map((b) => ({
          BillNumber: b.billNumber, Vendor: b.vendor.name,
          Date: formatDate(b.billDate), DueDate: formatDate(b.dueDate),
          Status: b.status, Total: Number(b.totalAmount), Paid: Number(b.amountPaid),
          Balance: Number(b.balanceDue), GstFiled: b.gstFiled, GSTR2B: b.gstr2bReflected,
        }))));
      }
      if (payments.length > 0) {
        zip.file("payments.csv", makeCsvString(payments.map((p) => ({
          Date: formatDate(p.paymentDate), Type: p.type, Amount: Number(p.amount),
          Mode: p.paymentMode, Reference: p.referenceNumber ?? "",
          Invoice: p.invoice?.invoiceNumber ?? "", Customer: p.customer?.name ?? "",
          Vendor: p.vendor?.name ?? "", VendorBill: p.vendorBill?.billNumber ?? "",
        }))));
      }

      // Add attachment index CSV
      if (attachments.length > 0) {
        zip.file("attachments_index.csv", makeCsvString(attachments.map((a) => ({
          EntityType: a.entityType,
          EntityId: a.entityId,
          FileName: a.fileName,
          FileSize: a.fileSize,
          MimeType: a.mimeType,
          StoragePath: a.storagePath,
          UploadedAt: formatDate(a.createdAt),
          DownloadUrl: `/api/attachments/${a.id}`,
        }))));

        // For local storage: fetch and bundle actual files
        // For object storage: skip bundling (files live in cloud, index CSV has URLs)
        if (!isObjectStorage) {
          const attFolder = zip.folder("attachments");
          if (attFolder) {
            for (const att of attachments) {
              try {
                const resp = await fetch(`/api/attachments/${att.id}`);
                if (resp.ok) {
                  const blob = await resp.blob();
                  const safeName = `${att.entityType}_${att.entityId.slice(0, 8)}_${att.fileName}`;
                  attFolder.file(safeName, blob);
                }
              } catch {
                // Skip files that can't be fetched
              }
            }
          }
        }
      }

      // Generate and download ZIP
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `data_backup_${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      // Record backup timestamp
      if (activeCompanyId) {
        setBackupTimestamp.mutate({
          companyId: activeCompanyId,
          key: "last_backup_at",
          value: new Date().toISOString(),
        });
      }
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
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold flex-1">Reports</h1>
        <Button variant="outline" onClick={handleBackup} disabled={backupLoading}>
          {backupLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Database className="h-4 w-4 mr-2" />}
          Data Backup (ZIP)
        </Button>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Outstanding Aging */}
      {activeTab === "aging" && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Outstanding Aging (Customer-wise)</CardTitle>
              {agingData && agingData.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => downloadCsv(agingData.map((r) => ({
                  Invoice: r.invoiceNumber, Customer: r.customerName,
                  InvoiceDate: formatDate(r.invoiceDate), DueDate: formatDate(r.dueDate),
                  Total: r.totalAmount, BalanceDue: r.balanceDue, DaysOverdue: r.daysOverdue, Bucket: r.bucket,
                })), "aging_report.csv")}>
                  <Download className="h-3.5 w-3.5 mr-1" />CSV
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {agingLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto my-8 text-muted-foreground" /> :
            !agingData?.length ? <p className="text-center py-8 text-muted-foreground">No outstanding invoices.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Invoice</th>
                      <th className="py-2 pr-3 font-medium">Customer</th>
                      <th className="py-2 pr-3 font-medium">Due Date</th>
                      <th className="py-2 pr-3 font-medium text-right">Balance</th>
                      <th className="py-2 pr-3 font-medium text-right">Days</th>
                      <th className="py-2 font-medium">Bucket</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agingData.map((r, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-mono text-xs">{r.invoiceNumber}</td>
                        <td className="py-2 pr-3">{r.customerName}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{formatDate(r.dueDate)}</td>
                        <td className="py-2 pr-3 text-right font-medium">{formatCurrency(r.balanceDue)}</td>
                        <td className="py-2 pr-3 text-right">{r.daysOverdue}</td>
                        <td className="py-2">
                          <span className={`text-xs font-medium ${r.bucket === "Current" ? "text-green-600" : r.bucket === "90+ days" ? "text-red-600" : "text-orange-600"}`}>
                            {r.bucket}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TDS Register */}
      {activeTab === "tds" && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">TDS Register (Invoice-wise)</CardTitle>
              {tdsData && tdsData.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => downloadCsv(tdsData.map((r) => ({
                  Invoice: r.invoiceNumber, Date: formatDate(r.invoiceDate), Customer: r.customerName,
                  PAN: r.customerPan ?? "", Total: r.totalAmount, TDSRate: r.tdsRate + "%",
                  TDSAmount: r.tdsAmount, CertStatus: r.certificateStatus,
                  CertDate: r.certificateReceivedDate ? formatDate(r.certificateReceivedDate) : "",
                })), "tds_register.csv")}>
                  <Download className="h-3.5 w-3.5 mr-1" />CSV
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {tdsLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto my-8 text-muted-foreground" /> :
            !tdsData?.length ? <p className="text-center py-8 text-muted-foreground">No TDS entries.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Invoice</th>
                      <th className="py-2 pr-3 font-medium">Date</th>
                      <th className="py-2 pr-3 font-medium">Customer</th>
                      <th className="py-2 pr-3 font-medium">PAN</th>
                      <th className="py-2 pr-3 font-medium text-right">Total</th>
                      <th className="py-2 pr-3 font-medium text-right">TDS %</th>
                      <th className="py-2 pr-3 font-medium text-right">TDS Amt</th>
                      <th className="py-2 font-medium">Cert Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tdsData.map((r, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-mono text-xs">{r.invoiceNumber}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{formatDate(r.invoiceDate)}</td>
                        <td className="py-2 pr-3">{r.customerName}</td>
                        <td className="py-2 pr-3 font-mono text-xs">{r.customerPan ?? "—"}</td>
                        <td className="py-2 pr-3 text-right">{formatCurrency(r.totalAmount)}</td>
                        <td className="py-2 pr-3 text-right">{r.tdsRate}%</td>
                        <td className="py-2 pr-3 text-right font-medium">{formatCurrency(r.tdsAmount)}</td>
                        <td className="py-2">
                          <span className={`text-xs font-medium capitalize ${r.certificateStatus === "received" ? "text-green-600" : "text-orange-600"}`}>
                            {r.certificateStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sales Summary */}
      {activeTab === "sales" && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Sales Summary (Month-wise)</CardTitle>
              {salesData && salesData.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => downloadCsv(salesData.map((r) => ({
                  Month: r.month, Invoices: r.invoiceCount, Taxable: r.taxableAmount,
                  CGST: r.cgst, SGST: r.sgst, IGST: r.igst, Total: r.totalAmount, Collected: r.collected,
                })), "sales_summary.csv")}>
                  <Download className="h-3.5 w-3.5 mr-1" />CSV
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {salesLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto my-8 text-muted-foreground" /> :
            !salesData?.length ? <p className="text-center py-8 text-muted-foreground">No sales data.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Month</th>
                      <th className="py-2 pr-3 font-medium text-right">Invoices</th>
                      <th className="py-2 pr-3 font-medium text-right">Taxable</th>
                      <th className="py-2 pr-3 font-medium text-right">CGST</th>
                      <th className="py-2 pr-3 font-medium text-right">SGST</th>
                      <th className="py-2 pr-3 font-medium text-right">IGST</th>
                      <th className="py-2 pr-3 font-medium text-right">Total</th>
                      <th className="py-2 font-medium text-right">Collected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesData.map((r, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-mono">{r.month}</td>
                        <td className="py-2 pr-3 text-right">{r.invoiceCount}</td>
                        <td className="py-2 pr-3 text-right">{formatCurrency(r.taxableAmount)}</td>
                        <td className="py-2 pr-3 text-right">{formatCurrency(r.cgst)}</td>
                        <td className="py-2 pr-3 text-right">{formatCurrency(r.sgst)}</td>
                        <td className="py-2 pr-3 text-right">{formatCurrency(r.igst)}</td>
                        <td className="py-2 pr-3 text-right font-medium">{formatCurrency(r.totalAmount)}</td>
                        <td className="py-2 text-right text-green-600">{formatCurrency(r.collected)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-medium">
                      <td className="py-2 pr-3">Total</td>
                      <td className="py-2 pr-3 text-right">{salesData.reduce((s, r) => s + r.invoiceCount, 0)}</td>
                      <td className="py-2 pr-3 text-right">{formatCurrency(salesData.reduce((s, r) => s + r.taxableAmount, 0))}</td>
                      <td className="py-2 pr-3 text-right">{formatCurrency(salesData.reduce((s, r) => s + r.cgst, 0))}</td>
                      <td className="py-2 pr-3 text-right">{formatCurrency(salesData.reduce((s, r) => s + r.sgst, 0))}</td>
                      <td className="py-2 pr-3 text-right">{formatCurrency(salesData.reduce((s, r) => s + r.igst, 0))}</td>
                      <td className="py-2 pr-3 text-right">{formatCurrency(salesData.reduce((s, r) => s + r.totalAmount, 0))}</td>
                      <td className="py-2 text-right text-green-600">{formatCurrency(salesData.reduce((s, r) => s + r.collected, 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Vendor GST / GSTR-2B Register */}
      {activeTab === "vendor-gst" && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Vendor GST / GSTR-2B Register</CardTitle>
              {vendorGstData && vendorGstData.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => downloadCsv(vendorGstData.map((r) => ({
                  Bill: r.billNumber, Date: formatDate(r.billDate), Vendor: r.vendorName,
                  GSTIN: r.vendorGstin ?? "", Taxable: r.taxableAmount, CGST: r.cgst, SGST: r.sgst,
                  IGST: r.igst, Total: r.totalAmount, GSTFiled: r.gstFiled ? "Yes" : "No",
                  GSTR2B: r.gstr2bReflected ? "Yes" : "No", ITCEligible: r.itcEligible ? "Yes" : "No",
                  PortalCheckDate: r.portalCheckDate ? formatDate(r.portalCheckDate) : "",
                })), "vendor_gst_register.csv")}>
                  <Download className="h-3.5 w-3.5 mr-1" />CSV
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {vendorGstLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto my-8 text-muted-foreground" /> :
            !vendorGstData?.length ? <p className="text-center py-8 text-muted-foreground">No vendor bills yet.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Bill #</th>
                      <th className="py-2 pr-3 font-medium">Vendor</th>
                      <th className="py-2 pr-3 font-medium">GSTIN</th>
                      <th className="py-2 pr-3 font-medium text-right">Total</th>
                      <th className="py-2 pr-3 font-medium text-center">GST Filed</th>
                      <th className="py-2 pr-3 font-medium text-center">2B</th>
                      <th className="py-2 font-medium text-center">ITC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendorGstData.map((r, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-mono text-xs">{r.billNumber}</td>
                        <td className="py-2 pr-3">{r.vendorName}</td>
                        <td className="py-2 pr-3 font-mono text-xs">{r.vendorGstin ?? "—"}</td>
                        <td className="py-2 pr-3 text-right font-medium">{formatCurrency(r.totalAmount)}</td>
                        <td className="py-2 pr-3 text-center">
                          <span className={`text-xs font-medium ${r.gstFiled ? "text-green-600" : "text-red-500"}`}>
                            {r.gstFiled ? "Yes" : "No"}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-center">
                          <span className={`text-xs font-medium ${r.gstr2bReflected ? "text-green-600" : "text-red-500"}`}>
                            {r.gstr2bReflected ? "Yes" : "No"}
                          </span>
                        </td>
                        <td className="py-2 text-center">
                          <span className={`text-xs font-medium ${r.itcEligible ? "text-green-600" : "text-gray-400"}`}>
                            {r.itcEligible ? "Yes" : "No"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
