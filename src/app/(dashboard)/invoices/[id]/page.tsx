"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { INVOICE_STATUSES, INDIAN_STATES, PAYMENT_MODES, TDS_RATES, TDS_CERTIFICATE_STATUSES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, Loader2, Printer, Send, CheckCircle, XCircle, IndianRupee, ChevronDown, ChevronUp, Save, Download } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { AttachmentPanel } from "@/components/attachments/attachment-panel";

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.id as string;
  const { activeCompanyId } = useCompanyStore();
  const printRef = useRef<HTMLDivElement>(null);

  const { data: invoice, isLoading } = trpc.invoice.get.useQuery(
    { id: invoiceId },
    { enabled: !!invoiceId }
  );
  const { data: company } = trpc.company.get.useQuery(
    { id: activeCompanyId! },
    { enabled: !!activeCompanyId }
  );

  const utils = trpc.useUtils();
  const updateStatus = trpc.invoice.updateStatus.useMutation({
    onSuccess: () => utils.invoice.get.invalidate({ id: invoiceId }),
  });
  const deleteMutation = trpc.invoice.delete.useMutation({
    onSuccess: () => router.push("/invoices"),
  });

  // Payment dialog state
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payDate, setPayDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [payAmount, setPayAmount] = useState(0);
  const [payMode, setPayMode] = useState("bank_transfer");
  const [payRef, setPayRef] = useState("");

  const recordPayment = trpc.payment.record.useMutation({
    onSuccess: () => {
      utils.invoice.get.invalidate({ id: invoiceId });
      utils.payment.list.invalidate();
      setPayDialogOpen(false);
    },
  });

  // TDS & Compliance state
  const [complianceOpen, setComplianceOpen] = useState(false);
  const [tdsApplicable, setTdsApplicable] = useState(false);
  const [tdsRate, setTdsRate] = useState(10);
  const [tdsAmount, setTdsAmount] = useState(0);
  const [tdsCertStatus, setTdsCertStatus] = useState("not_applicable");
  const [tdsCertDate, setTdsCertDate] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [complianceLoaded, setComplianceLoaded] = useState(false);

  const updateCompliance = trpc.invoice.updateCompliance.useMutation({
    onSuccess: () => utils.invoice.get.invalidate({ id: invoiceId }),
  });

  // Load compliance fields from invoice data
  if (invoice && !complianceLoaded) {
    setTdsApplicable(invoice.tdsApplicable ?? false);
    setTdsRate(Number(invoice.tdsRate ?? 10));
    setTdsAmount(Number(invoice.tdsAmount ?? 0));
    setTdsCertStatus(invoice.tdsCertificateStatus ?? "not_applicable");
    setTdsCertDate(invoice.tdsCertificateReceivedDate ? format(new Date(invoice.tdsCertificateReceivedDate), "yyyy-MM-dd") : "");
    setFollowUpDate(invoice.nextFollowUpDate ? format(new Date(invoice.nextFollowUpDate), "yyyy-MM-dd") : "");
    setFollowUpNotes(invoice.followUpNotes ?? "");
    setComplianceLoaded(true);
  }

  function saveCompliance() {
    updateCompliance.mutate({
      id: invoiceId,
      tdsApplicable,
      tdsRate: tdsApplicable ? tdsRate : null,
      tdsAmount: tdsApplicable ? tdsAmount : 0,
      tdsCertificateStatus: tdsApplicable ? tdsCertStatus : "not_applicable",
      tdsCertificateReceivedDate: tdsCertDate || null,
      nextFollowUpDate: followUpDate || null,
      followUpNotes: followUpNotes || null,
    });
  }

  function openPayDialog() {
    setPayDate(format(new Date(), "yyyy-MM-dd"));
    setPayAmount(Number(invoice?.balanceDue ?? 0));
    setPayMode("bank_transfer");
    setPayRef("");
    setPayDialogOpen(true);
  }

  function handlePaySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCompanyId || !invoiceId || payAmount <= 0) return;
    recordPayment.mutate({
      companyId: activeCompanyId,
      invoiceId,
      paymentDate: payDate,
      amount: payAmount,
      paymentMode: payMode,
      referenceNumber: payRef || null,
    });
  }

  function getStatusBadge(status: string) {
    const s = INVOICE_STATUSES.find((st) => st.value === status);
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${s?.color ?? "bg-gray-100 text-gray-700"}`}>
        {s?.label ?? status}
      </span>
    );
  }

  const downloadPdf = trpc.invoice.downloadPdf.useMutation();

  async function handleDownloadPdf() {
    if (!activeCompanyId) return;
    try {
      const result = await downloadPdf.mutateAsync({
        id: invoiceId,
        companyId: activeCompanyId,
      });
      const byteChars = atob(result.pdf);
      const byteNumbers = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([byteNumbers], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF download failed:", err);
      alert("Failed to generate PDF. Please try again.");
    }
  }

  function handlePrint() {
    window.print();
  }

  function getStateName(stateCode: string | null | undefined) {
    if (!stateCode) return "";
    return INDIAN_STATES.find((s) => s.code === stateCode)?.name ?? stateCode;
  }

  const isInterState =
    invoice?.placeOfSupply && company?.state
      ? invoice.placeOfSupply !== company.state
      : false;

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Invoice not found.</p>
        <Link href="/invoices"><Button variant="outline" className="mt-4">Back to Invoices</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 print:hidden">
        <Link href="/invoices">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">{invoice.invoiceNumber}</h1>
            {getStatusBadge(invoice.status)}
          </div>
          <p className="text-sm text-gray-500">{invoice.customer.name}</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button variant="outline" size="sm" className="h-9" onClick={handleDownloadPdf} disabled={downloadPdf.isPending}>
          {downloadPdf.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
          Download PDF
        </Button>
        <Button variant="outline" size="sm" className="h-9" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-1.5" /> Print
        </Button>
        {invoice.status === "draft" && (
          <Button size="sm" className="h-9 bg-blue-600 hover:bg-blue-700"
            onClick={() => updateStatus.mutate({ id: invoiceId, status: "sent" })}
            disabled={updateStatus.isPending}
          >
            <Send className="h-4 w-4 mr-1.5" /> Mark as Sent
          </Button>
        )}
        {(invoice.status === "sent" || invoice.status === "partially_paid") && (
          <Button variant="outline" size="sm" className="h-9"
            onClick={() => updateStatus.mutate({ id: invoiceId, status: "paid" })}
            disabled={updateStatus.isPending}
          >
            <CheckCircle className="h-4 w-4 mr-1.5" /> Mark as Paid
          </Button>
        )}
        {(invoice.status === "sent" || invoice.status === "partially_paid" || invoice.status === "overdue") && (
          <Button size="sm" className="h-9 bg-emerald-600 hover:bg-emerald-700" onClick={openPayDialog}>
            <IndianRupee className="h-4 w-4 mr-1.5" /> Record Payment
          </Button>
        )}
        {invoice.status !== "cancelled" && invoice.status !== "paid" && (
          <Button variant="outline" size="sm" className="h-9 text-gray-500 hover:text-red-600 hover:border-red-200"
            onClick={() => updateStatus.mutate({ id: invoiceId, status: "cancelled" })}
            disabled={updateStatus.isPending}
          >
            <XCircle className="h-4 w-4 mr-1.5" /> Cancel
          </Button>
        )}
      </div>

      {/* Printable Invoice */}
      <div ref={printRef} className="bg-white rounded-lg border print:shadow-none print:border-0">
        <div className="p-6 sm:p-8 space-y-6">
          {/* Company & Invoice Info Header */}
          <div className="flex flex-col sm:flex-row justify-between gap-6">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-gray-900">{company?.legalName || company?.name}</h2>
              {company?.gstin && (
                <p className="text-sm">
                  <span className="text-gray-500">GSTIN:</span>{" "}
                  <span className="font-mono font-medium">{company.gstin}</span>
                </p>
              )}
              <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
                {[company?.addressLine1, company?.addressLine2, company?.city, company?.stateName, company?.pincode]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              {company?.phone && <p className="text-sm text-gray-500">Phone: {company.phone}</p>}
              {company?.email && <p className="text-sm text-gray-500">Email: {company.email}</p>}
            </div>
            <div className="sm:text-right shrink-0">
              <h3 className="text-2xl font-bold text-blue-600 tracking-wide">INVOICE</h3>
              <p className="font-mono text-base font-semibold text-gray-900 mt-1">{invoice.invoiceNumber}</p>
              <div className="mt-3 space-y-1">
                <DetailRow label="Date" value={formatDate(invoice.invoiceDate)} />
                <DetailRow label="Due Date" value={formatDate(invoice.dueDate)} />
                {invoice.placeOfSupply && (
                  <DetailRow label="Place of Supply" value={getStateName(invoice.placeOfSupply)} />
                )}
              </div>
            </div>
          </div>

          <div className="border-t" />

          {/* Bill To */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Bill To</p>
            <p className="font-semibold text-gray-900">{invoice.customer.name}</p>
            {invoice.customer.gstin && (
              <p className="text-sm mt-0.5">
                <span className="text-gray-500">GSTIN:</span>{" "}
                <span className="font-mono">{invoice.customer.gstin}</span>
              </p>
            )}
            <p className="text-sm text-gray-500 mt-1 leading-relaxed">
              {[
                invoice.customer.billingAddressLine1,
                invoice.customer.billingAddressLine2,
                invoice.customer.billingCity,
                invoice.customer.billingStateName,
                invoice.customer.billingPincode,
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
            {invoice.customer.contactEmail && (
              <p className="text-sm text-gray-500">{invoice.customer.contactEmail}</p>
            )}
            {invoice.customer.contactPhone && (
              <p className="text-sm text-gray-500">{invoice.customer.contactPhone}</p>
            )}
          </div>

          {/* Line items table */}
          <div className="overflow-x-auto -mx-6 sm:-mx-8">
            <div className="px-6 sm:px-8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y bg-gray-50/80">
                    <th className="py-2.5 pl-0 pr-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 w-10">#</th>
                    <th className="py-2.5 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Description</th>
                    <th className="py-2.5 px-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 w-[80px]">HSN/SAC</th>
                    <th className="py-2.5 px-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500 w-[80px]">Qty</th>
                    <th className="py-2.5 px-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500 w-[100px]">Rate</th>
                    <th className="py-2.5 px-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500 w-[60px]">GST%</th>
                    <th className="py-2.5 pl-3 pr-0 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500 w-[110px]">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lines.map((line, idx) => (
                    <tr key={line.id} className="border-b border-gray-100">
                      <td className="py-3 pl-0 pr-3 text-gray-400 tabular-nums">{idx + 1}</td>
                      <td className="py-3 px-3 text-gray-900">{line.description}</td>
                      <td className="py-3 px-3 font-mono text-xs text-gray-500">{line.hsnSacCode || "\u2014"}</td>
                      <td className="py-3 px-3 text-right tabular-nums text-gray-700">
                        {Number(line.quantity)} {line.unit}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-gray-700">{formatCurrency(Number(line.rate))}</td>
                      <td className="py-3 px-3 text-right tabular-nums text-gray-500">{Number(line.gstRate)}%</td>
                      <td className="py-3 pl-3 pr-0 text-right font-semibold text-gray-900 tabular-nums">{formatCurrency(Number(line.lineTotal))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-full max-w-[300px] space-y-1.5">
              <TotalRow label="Subtotal" value={formatCurrency(Number(invoice.subtotal))} />
              {Number(invoice.discountAmount) > 0 && (
                <TotalRow label="Discount" value={`-${formatCurrency(Number(invoice.discountAmount))}`} valueColor="text-emerald-600" />
              )}
              <TotalRow label="Taxable Amount" value={formatCurrency(Number(invoice.taxableAmount))} />
              {!isInterState ? (
                <>
                  <TotalRow label="CGST" value={formatCurrency(Number(invoice.cgstAmount))} />
                  <TotalRow label="SGST" value={formatCurrency(Number(invoice.sgstAmount))} />
                </>
              ) : (
                <TotalRow label="IGST" value={formatCurrency(Number(invoice.igstAmount))} />
              )}
              <div className="border-t-2 border-gray-900 pt-2 flex justify-between items-center">
                <span className="font-bold text-gray-900">Total</span>
                <span className="font-bold text-lg text-gray-900 tabular-nums">{formatCurrency(Number(invoice.totalAmount))}</span>
              </div>
              {Number(invoice.amountPaid) > 0 && (
                <>
                  <TotalRow label="Paid" value={`-${formatCurrency(Number(invoice.amountPaid))}`} valueColor="text-emerald-600" />
                  <div className="border-t pt-2 flex justify-between items-center">
                    <span className="font-bold text-gray-900">Balance Due</span>
                    <span className="font-bold text-lg text-blue-600 tabular-nums">{formatCurrency(Number(invoice.balanceDue))}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Bank details */}
          {invoice.bankName && (
            <div className="border-t pt-5">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Bank Details</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-gray-500 text-xs">Bank</p>
                  <p className="font-medium text-gray-900">{invoice.bankName}</p>
                </div>
                {invoice.bankAccountNo && (
                  <div>
                    <p className="text-gray-500 text-xs">A/C No</p>
                    <p className="font-mono font-medium text-gray-900">{invoice.bankAccountNo}</p>
                  </div>
                )}
                {invoice.bankIfsc && (
                  <div>
                    <p className="text-gray-500 text-xs">IFSC</p>
                    <p className="font-mono font-medium text-gray-900">{invoice.bankIfsc}</p>
                  </div>
                )}
                {invoice.bankBranch && (
                  <div>
                    <p className="text-gray-500 text-xs">Branch</p>
                    <p className="font-medium text-gray-900">{invoice.bankBranch}</p>
                  </div>
                )}
                {invoice.bankUpiId && (
                  <div>
                    <p className="text-gray-500 text-xs">UPI</p>
                    <p className="font-mono font-medium text-gray-900">{invoice.bankUpiId}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {invoice.notes && (
            <div className="border-t pt-5">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Notes / Terms</p>
              <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{invoice.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Payment history */}
      {invoice.payments && invoice.payments.length > 0 && (
        <div className="bg-white rounded-lg border print:hidden">
          <div className="px-6 py-4 border-b">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Payment History</h3>
          </div>
          <div className="p-6">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Mode</th>
                  <th>Reference</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="text-gray-700">{formatDate(p.paymentDate)}</td>
                    <td className="text-gray-700 capitalize">{p.paymentMode.replace("_", " ")}</td>
                    <td className="font-mono text-xs text-gray-500">{p.referenceNumber || "\u2014"}</td>
                    <td className="text-right font-semibold text-gray-900 tabular-nums">{formatCurrency(Number(p.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Attachments */}
      <AttachmentPanel entityType="invoice" entityId={invoiceId} />

      {/* TDS & Compliance */}
      {invoice.status !== "draft" && invoice.status !== "cancelled" && (
        <div className="bg-white rounded-lg border print:hidden">
          <button
            className="w-full flex items-center justify-between px-6 py-4"
            onClick={() => setComplianceOpen(!complianceOpen)}
          >
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">TDS & Compliance</h3>
            {complianceOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </button>
          {complianceOpen && (
            <div className="px-6 pb-6 space-y-4 border-t pt-4">
              {/* TDS Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="tds-applicable"
                    checked={tdsApplicable}
                    onChange={(e) => setTdsApplicable(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Label htmlFor="tds-applicable" className="font-medium text-gray-700">TDS Applicable</Label>
                </div>

                {tdsApplicable && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pl-6">
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">TDS Rate %</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={tdsRate}
                        onChange={(e) => {
                          const rate = parseFloat(e.target.value);
                          setTdsRate(rate);
                          setTdsAmount(Math.round(Number(invoice.totalAmount) * rate / 100 * 100) / 100);
                        }}
                      >
                        {TDS_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">TDS Amount</Label>
                      <Input
                        type="number"
                        step="0.01"
                        className="h-9 bg-gray-50"
                        value={tdsAmount}
                        onChange={(e) => setTdsAmount(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">Certificate Status</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={tdsCertStatus}
                        onChange={(e) => setTdsCertStatus(e.target.value)}
                      >
                        {TDS_CERTIFICATE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                    {tdsCertStatus === "received" && (
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">Received Date</Label>
                        <Input
                          type="date"
                          className="h-9 bg-gray-50"
                          value={tdsCertDate}
                          onChange={(e) => setTdsCertDate(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Follow-up */}
              <div className="border-t pt-4 space-y-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Follow-up</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Next Follow-up Date</Label>
                    <Input
                      type="date"
                      className="h-9 bg-gray-50"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Notes</Label>
                    <Input
                      className="h-9 bg-gray-50"
                      value={followUpNotes}
                      onChange={(e) => setFollowUpNotes(e.target.value)}
                      placeholder="Follow-up notes..."
                    />
                  </div>
                </div>
              </div>

              {/* Save button */}
              <div className="flex justify-end pt-1">
                <Button size="sm" className="h-9 bg-blue-600 hover:bg-blue-700" onClick={saveCompliance} disabled={updateCompliance.isPending}>
                  {updateCompliance.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
                  Save Compliance
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete invoice */}
      <div className="flex justify-end print:hidden pb-6">
        <Button
          variant="outline"
          size="sm"
          className="h-9 text-red-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200"
          onClick={() => {
            if (confirm("Delete this invoice? It will be moved to trash.")) {
              deleteMutation.mutate({ id: invoiceId });
            }
          }}
          disabled={deleteMutation.isPending}
        >
          Delete Invoice
        </Button>
      </div>

      {/* Record Payment Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogHeader>
          <DialogTitle>Record Payment for {invoice.invoiceNumber}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handlePaySubmit} className="space-y-4">
          <div className="text-sm text-gray-500">
            Balance due: <span className="font-semibold text-gray-900">{formatCurrency(Number(invoice.balanceDue))}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Date *</Label>
              <Input type="date" className="h-9 bg-gray-50" value={payDate} onChange={(e) => setPayDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Amount *</Label>
              <Input type="number" step="0.01" min="0.01" className="h-9 bg-gray-50" value={payAmount} onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Mode</Label>
              <select
                className="flex h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={payMode}
                onChange={(e) => setPayMode(e.target.value)}
              >
                {PAYMENT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Reference #</Label>
              <Input className="h-9 bg-gray-50" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="UTR / Cheque" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
            <Button type="submit" size="sm" className="h-9 bg-blue-600 hover:bg-blue-700" disabled={recordPayment.isPending}>
              {recordPayment.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Record Payment
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

/* ---- Helper components ---- */

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm sm:justify-end">
      <span className="text-gray-500">{label}:</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}

function TotalRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={`font-medium tabular-nums ${valueColor ?? "text-gray-900"}`}>{value}</span>
    </div>
  );
}
