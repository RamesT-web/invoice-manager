"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { INVOICE_STATUSES, INDIAN_STATES, PAYMENT_MODES, TDS_RATES, TDS_CERTIFICATE_STATUSES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, Loader2, Printer, Send, CheckCircle, XCircle, IndianRupee, ChevronDown, ChevronUp, Save } from "lucide-react";
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
      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${s?.color ?? "bg-gray-100 text-gray-700"}`}>
        {s?.label ?? status}
      </span>
    );
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
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Invoice not found.</p>
        <Link href="/invoices"><Button variant="outline" className="mt-4">Back to Invoices</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Header - hidden during print */}
      <div className="flex items-center gap-3 print:hidden">
        <Link href="/invoices"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{invoice.invoiceNumber}</h1>
          <p className="text-sm text-muted-foreground">{invoice.customer.name}</p>
        </div>
        {getStatusBadge(invoice.status)}
      </div>

      {/* Actions - hidden during print */}
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-1" /> Print / PDF
        </Button>
        {invoice.status === "draft" && (
          <Button
            size="sm"
            onClick={() => updateStatus.mutate({ id: invoiceId, status: "sent" })}
            disabled={updateStatus.isPending}
          >
            <Send className="h-4 w-4 mr-1" /> Mark as Sent
          </Button>
        )}
        {(invoice.status === "sent" || invoice.status === "partially_paid") && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateStatus.mutate({ id: invoiceId, status: "paid" })}
            disabled={updateStatus.isPending}
          >
            <CheckCircle className="h-4 w-4 mr-1" /> Mark as Paid
          </Button>
        )}
        {(invoice.status === "sent" || invoice.status === "partially_paid" || invoice.status === "overdue") && (
          <Button
            size="sm"
            onClick={openPayDialog}
          >
            <IndianRupee className="h-4 w-4 mr-1" /> Record Payment
          </Button>
        )}
        {invoice.status !== "cancelled" && invoice.status !== "paid" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateStatus.mutate({ id: invoiceId, status: "cancelled" })}
            disabled={updateStatus.isPending}
          >
            <XCircle className="h-4 w-4 mr-1" /> Cancel
          </Button>
        )}
      </div>

      {/* Printable Invoice */}
      <div ref={printRef} className="bg-white print:shadow-none">
        <Card className="print:shadow-none print:border-0">
          <CardContent className="p-6 sm:p-8 space-y-6">
            {/* Company & Invoice Info Header */}
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">{company?.legalName || company?.name}</h2>
                {company?.gstin && <p className="text-sm font-mono">GSTIN: {company.gstin}</p>}
                <p className="text-sm text-muted-foreground mt-1">
                  {[company?.addressLine1, company?.addressLine2, company?.city, company?.stateName, company?.pincode]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                {company?.phone && <p className="text-sm text-muted-foreground">Phone: {company.phone}</p>}
                {company?.email && <p className="text-sm text-muted-foreground">Email: {company.email}</p>}
              </div>
              <div className="text-left sm:text-right">
                <h3 className="text-2xl font-bold text-primary">INVOICE</h3>
                <p className="font-mono font-medium">{invoice.invoiceNumber}</p>
                <div className="mt-2 text-sm space-y-0.5">
                  <p><span className="text-muted-foreground">Date:</span> {formatDate(invoice.invoiceDate)}</p>
                  <p><span className="text-muted-foreground">Due:</span> {formatDate(invoice.dueDate)}</p>
                  {invoice.placeOfSupply && (
                    <p><span className="text-muted-foreground">Place of Supply:</span> {getStateName(invoice.placeOfSupply)}</p>
                  )}
                </div>
              </div>
            </div>

            <hr />

            {/* Bill To */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Bill To</p>
              <p className="font-semibold">{invoice.customer.name}</p>
              {invoice.customer.gstin && <p className="text-sm font-mono">GSTIN: {invoice.customer.gstin}</p>}
              <p className="text-sm text-muted-foreground">
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
                <p className="text-sm text-muted-foreground">{invoice.customer.contactEmail}</p>
              )}
              {invoice.customer.contactPhone && (
                <p className="text-sm text-muted-foreground">{invoice.customer.contactPhone}</p>
              )}
            </div>

            {/* Line items table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-t text-left">
                    <th className="py-2 pr-2 font-medium">#</th>
                    <th className="py-2 pr-2 font-medium">Description</th>
                    <th className="py-2 pr-2 font-medium">HSN/SAC</th>
                    <th className="py-2 pr-2 font-medium text-right">Qty</th>
                    <th className="py-2 pr-2 font-medium text-right">Rate</th>
                    <th className="py-2 pr-2 font-medium text-right">GST%</th>
                    <th className="py-2 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lines.map((line, idx) => (
                    <tr key={line.id} className="border-b">
                      <td className="py-2 pr-2 text-muted-foreground">{idx + 1}</td>
                      <td className="py-2 pr-2">{line.description}</td>
                      <td className="py-2 pr-2 font-mono text-xs">{line.hsnSacCode || "—"}</td>
                      <td className="py-2 pr-2 text-right">
                        {Number(line.quantity)} {line.unit}
                      </td>
                      <td className="py-2 pr-2 text-right">{formatCurrency(Number(line.rate))}</td>
                      <td className="py-2 pr-2 text-right">{Number(line.gstRate)}%</td>
                      <td className="py-2 text-right font-medium">{formatCurrency(Number(line.lineTotal))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-full max-w-xs space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(Number(invoice.subtotal))}</span>
                </div>
                {Number(invoice.discountAmount) > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(Number(invoice.discountAmount))}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taxable Amount</span>
                  <span>{formatCurrency(Number(invoice.taxableAmount))}</span>
                </div>
                {!isInterState ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CGST</span>
                      <span>{formatCurrency(Number(invoice.cgstAmount))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">SGST</span>
                      <span>{formatCurrency(Number(invoice.sgstAmount))}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IGST</span>
                    <span>{formatCurrency(Number(invoice.igstAmount))}</span>
                  </div>
                )}
                <div className="border-t pt-1 flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span>{formatCurrency(Number(invoice.totalAmount))}</span>
                </div>
                {Number(invoice.amountPaid) > 0 && (
                  <>
                    <div className="flex justify-between text-green-600">
                      <span>Paid</span>
                      <span>-{formatCurrency(Number(invoice.amountPaid))}</span>
                    </div>
                    <div className="border-t pt-1 flex justify-between font-bold text-base">
                      <span>Balance Due</span>
                      <span>{formatCurrency(Number(invoice.balanceDue))}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Bank details */}
            {invoice.bankName && (
              <div className="border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Bank Details</p>
                <div className="text-sm space-y-0.5">
                  <p>Bank: {invoice.bankName}</p>
                  {invoice.bankAccountNo && <p>A/C No: {invoice.bankAccountNo}</p>}
                  {invoice.bankIfsc && <p>IFSC: {invoice.bankIfsc}</p>}
                  {invoice.bankBranch && <p>Branch: {invoice.bankBranch}</p>}
                  {invoice.bankUpiId && <p>UPI: {invoice.bankUpiId}</p>}
                </div>
              </div>
            )}

            {/* Notes */}
            {invoice.notes && (
              <div className="border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Notes / Terms</p>
                <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment history */}
      {invoice.payments && invoice.payments.length > 0 && (
        <Card className="print:hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 font-medium">Mode</th>
                  <th className="py-2 font-medium">Reference</th>
                  <th className="py-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.payments.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2">{formatDate(p.paymentDate)}</td>
                    <td className="py-2 capitalize">{p.paymentMode.replace("_", " ")}</td>
                    <td className="py-2 font-mono text-xs">{p.referenceNumber || "—"}</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(Number(p.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Attachments */}
      <AttachmentPanel entityType="invoice" entityId={invoiceId} />

      {/* TDS & Compliance */}
      {invoice.status !== "draft" && invoice.status !== "cancelled" && (
        <Card className="print:hidden">
          <CardHeader className="pb-2 cursor-pointer" onClick={() => setComplianceOpen(!complianceOpen)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">TDS & Compliance</CardTitle>
              {complianceOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </CardHeader>
          {complianceOpen && (
            <CardContent className="space-y-4">
              {/* TDS Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="tds-applicable"
                    checked={tdsApplicable}
                    onChange={(e) => setTdsApplicable(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="tds-applicable" className="font-medium">TDS Applicable</Label>
                </div>

                {tdsApplicable && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pl-6">
                    <div className="space-y-1">
                      <Label className="text-xs">TDS Rate %</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
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
                      <Label className="text-xs">TDS Amount</Label>
                      <Input
                        type="number"
                        step="0.01"
                        className="h-9"
                        value={tdsAmount}
                        onChange={(e) => setTdsAmount(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Certificate Status</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                        value={tdsCertStatus}
                        onChange={(e) => setTdsCertStatus(e.target.value)}
                      >
                        {TDS_CERTIFICATE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                    {tdsCertStatus === "received" && (
                      <div className="space-y-1">
                        <Label className="text-xs">Received Date</Label>
                        <Input
                          type="date"
                          className="h-9"
                          value={tdsCertDate}
                          onChange={(e) => setTdsCertDate(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Follow-up */}
              <div className="border-t pt-3 space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Follow-up</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Next Follow-up Date</Label>
                    <Input
                      type="date"
                      className="h-9"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Notes</Label>
                    <Input
                      className="h-9"
                      value={followUpNotes}
                      onChange={(e) => setFollowUpNotes(e.target.value)}
                      placeholder="Follow-up notes..."
                    />
                  </div>
                </div>
              </div>

              {/* Save button */}
              <div className="flex justify-end pt-1">
                <Button size="sm" onClick={saveCompliance} disabled={updateCompliance.isPending}>
                  {updateCompliance.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Save Compliance
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Delete (only for drafts) */}
      {invoice.status === "draft" && (
        <div className="flex justify-end print:hidden pb-6">
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => {
              if (confirm("Delete this draft invoice?")) {
                deleteMutation.mutate({ id: invoiceId });
              }
            }}
            disabled={deleteMutation.isPending}
          >
            Delete Draft
          </Button>
        </div>
      )}

      {/* Record Payment Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogHeader>
          <DialogTitle>Record Payment for {invoice.invoiceNumber}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handlePaySubmit} className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Balance due: <span className="font-medium text-foreground">{formatCurrency(Number(invoice.balanceDue))}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Date *</Label>
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Amount *</Label>
              <Input type="number" step="0.01" min="0.01" value={payAmount} onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Mode</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={payMode} onChange={(e) => setPayMode(e.target.value)}>
                {PAYMENT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Reference #</Label>
              <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="UTR / Cheque" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={recordPayment.isPending}>
              {recordPayment.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Record Payment
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
