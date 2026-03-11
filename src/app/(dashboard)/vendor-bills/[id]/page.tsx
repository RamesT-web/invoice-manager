"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PAYMENT_MODES, TDS_RATES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, Loader2, IndianRupee, XCircle, CheckCircle, ChevronDown, ChevronUp, Save } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { AttachmentPanel } from "@/components/attachments/attachment-panel";

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm py-1.5">
      <span className="text-gray-500">{label}</span>
      <span className="tabular-nums">{children}</span>
    </div>
  );
}

export default function VendorBillDetailPage() {
  const params = useParams();
  const router = useRouter();
  const billId = params.id as string;
  const { activeCompanyId } = useCompanyStore();
  const utils = trpc.useUtils();

  const { data: bill, isLoading } = trpc.vendorBill.get.useQuery({ id: billId }, { enabled: !!billId });
  const updateStatus = trpc.vendorBill.updateStatus.useMutation({ onSuccess: () => utils.vendorBill.get.invalidate({ id: billId }) });
  const deleteMutation = trpc.vendorBill.delete.useMutation({ onSuccess: () => router.push("/vendor-bills") });

  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payDate, setPayDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [payAmount, setPayAmount] = useState(0);
  const [payMode, setPayMode] = useState("bank_transfer");
  const [payRef, setPayRef] = useState("");

  const recordPayment = trpc.vendorBill.recordPayment.useMutation({
    onSuccess: () => { utils.vendorBill.get.invalidate({ id: billId }); utils.payment.list.invalidate(); setPayDialogOpen(false); },
  });

  const [complianceOpen, setComplianceOpen] = useState(false);
  const [tdsApplicable, setTdsApplicable] = useState(false);
  const [tdsRate, setTdsRate] = useState(10);
  const [tdsAmount, setTdsAmount] = useState(0);
  const [gstFiled, setGstFiled] = useState(false);
  const [gstr2bReflected, setGstr2bReflected] = useState(false);
  const [portalCheckDate, setPortalCheckDate] = useState("");
  const [itcEligible, setItcEligible] = useState(true);
  const [complianceNotes, setComplianceNotes] = useState("");
  const [complianceLoaded, setComplianceLoaded] = useState(false);

  const updateCompliance = trpc.vendorBill.updateCompliance.useMutation({ onSuccess: () => utils.vendorBill.get.invalidate({ id: billId }) });

  if (bill && !complianceLoaded) {
    setTdsApplicable(bill.tdsApplicable ?? false);
    setTdsRate(Number(bill.tdsRate ?? 10));
    setTdsAmount(Number(bill.tdsAmount ?? 0));
    setGstFiled(bill.gstFiled ?? false);
    setGstr2bReflected(bill.gstr2bReflected ?? false);
    setPortalCheckDate(bill.portalCheckDate ? format(new Date(bill.portalCheckDate), "yyyy-MM-dd") : "");
    setItcEligible(bill.itcEligible ?? true);
    setComplianceNotes(bill.complianceNotes ?? "");
    setComplianceLoaded(true);
  }

  function openPayDialog() {
    setPayDate(format(new Date(), "yyyy-MM-dd"));
    setPayAmount(Number(bill?.balanceDue ?? 0));
    setPayMode("bank_transfer");
    setPayRef("");
    setPayDialogOpen(true);
  }

  function handlePaySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCompanyId || !billId || payAmount <= 0) return;
    recordPayment.mutate({ companyId: activeCompanyId, vendorBillId: billId, paymentDate: payDate, amount: payAmount, paymentMode: payMode, referenceNumber: payRef || null });
  }

  function saveCompliance() {
    updateCompliance.mutate({ id: billId, tdsApplicable, tdsRate: tdsApplicable ? tdsRate : null, tdsAmount: tdsApplicable ? tdsAmount : 0, gstFiled, gstr2bReflected, portalCheckDate: portalCheckDate || null, itcEligible, complianceNotes: complianceNotes || null });
  }

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;
  if (!bill) return <div className="text-center py-16"><p className="text-gray-500">Vendor bill not found.</p><Link href="/vendor-bills"><Button variant="outline" className="mt-4 h-9">Back</Button></Link></div>;

  const statusColors: Record<string, string> = { pending: "bg-yellow-100 text-yellow-700", partially_paid: "bg-blue-100 text-blue-700", paid: "bg-green-100 text-green-700", cancelled: "bg-gray-100 text-gray-500" };

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/vendor-bills"><Button variant="ghost" size="icon" className="h-9 w-9"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">{bill.billNumber}</h1>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${statusColors[bill.status] ?? ""}`}>{bill.status.replace("_", " ")}</span>
          </div>
          <p className="text-sm text-gray-500">{bill.vendor.name}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(bill.status === "pending" || bill.status === "partially_paid") && (
          <>
            <Button size="sm" className="h-9 bg-emerald-600 hover:bg-emerald-700" onClick={openPayDialog}><IndianRupee className="h-4 w-4 mr-1" /> Record Payment</Button>
            <Button size="sm" variant="outline" className="h-9" onClick={() => updateStatus.mutate({ id: billId, status: "paid" })} disabled={updateStatus.isPending}><CheckCircle className="h-4 w-4 mr-1" /> Mark Paid</Button>
          </>
        )}
        {bill.status !== "cancelled" && bill.status !== "paid" && (
          <Button size="sm" variant="outline" className="h-9" onClick={() => updateStatus.mutate({ id: billId, status: "cancelled" })} disabled={updateStatus.isPending}><XCircle className="h-4 w-4 mr-1" /> Cancel</Button>
        )}
      </div>

      <div className="bg-white rounded-lg border p-6 space-y-5">
        <div className="flex justify-between text-sm">
          <div>
            <p className="font-semibold text-gray-900">{bill.vendor.name}</p>
            {bill.vendor.gstin && <p className="font-mono text-xs text-gray-500">GSTIN: {bill.vendor.gstin}</p>}
          </div>
          <div className="text-right space-y-0.5">
            <p><span className="text-gray-500">Bill Date:</span> {formatDate(bill.billDate)}</p>
            <p><span className="text-gray-500">Due Date:</span> {formatDate(bill.dueDate)}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th className="w-10">#</th><th>Description</th><th>HSN/SAC</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">GST%</th><th className="text-right">Amount</th></tr></thead>
            <tbody>
              {bill.lines.map((line, idx) => (
                <tr key={line.id}>
                  <td className="text-gray-400">{idx + 1}</td>
                  <td className="text-gray-900">{line.description}</td>
                  <td className="font-mono text-xs text-gray-500">{line.hsnSacCode || "\u2014"}</td>
                  <td className="text-right tabular-nums">{Number(line.quantity)} {line.unit}</td>
                  <td className="text-right tabular-nums">{formatCurrency(Number(line.rate))}</td>
                  <td className="text-right tabular-nums">{Number(line.gstRate)}%</td>
                  <td className="text-right font-semibold tabular-nums text-gray-900">{formatCurrency(Number(line.lineTotal))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <div className="w-full max-w-xs space-y-1.5 text-sm">
            <DetailRow label="Subtotal">{formatCurrency(Number(bill.subtotal))}</DetailRow>
            <DetailRow label="Tax">{formatCurrency(Number(bill.cgstAmount) + Number(bill.sgstAmount) + Number(bill.igstAmount))}</DetailRow>
            <div className="border-t-2 border-gray-900 pt-2 flex justify-between font-bold text-base"><span>Total</span><span className="tabular-nums">{formatCurrency(Number(bill.totalAmount))}</span></div>
            {Number(bill.amountPaid) > 0 && (
              <>
                <div className="flex justify-between text-green-600 text-sm pt-1"><span>Paid</span><span className="tabular-nums">-{formatCurrency(Number(bill.amountPaid))}</span></div>
                <div className="border-t pt-1 flex justify-between font-bold text-base text-blue-600"><span>Balance Due</span><span className="tabular-nums">{formatCurrency(Number(bill.balanceDue))}</span></div>
              </>
            )}
          </div>
        </div>
      </div>

      {bill.payments && bill.payments.length > 0 && (
        <div className="bg-white rounded-lg border">
          <div className="px-6 py-4 border-b"><h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Payment History</h2></div>
          <table className="data-table">
            <thead><tr><th>Date</th><th>Mode</th><th>Reference</th><th className="text-right">Amount</th></tr></thead>
            <tbody>
              {bill.payments.map((p) => (
                <tr key={p.id}>
                  <td className="text-gray-900">{formatDate(p.paymentDate)}</td>
                  <td className="capitalize text-gray-500">{p.paymentMode.replace("_", " ")}</td>
                  <td className="font-mono text-xs text-gray-500">{p.referenceNumber || "\u2014"}</td>
                  <td className="text-right font-semibold tabular-nums text-gray-900">{formatCurrency(Number(p.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AttachmentPanel entityType="vendor_bill" entityId={billId} />

      {bill.status !== "cancelled" && (
        <div className="bg-white rounded-lg border">
          <button className="w-full px-6 py-4 flex items-center justify-between" onClick={() => setComplianceOpen(!complianceOpen)}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">GST & TDS Compliance</h2>
            {complianceOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </button>
          {complianceOpen && (
            <div className="px-6 pb-6 space-y-4 border-t">
              <div className="space-y-3 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">GST Compliance</p>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2"><input type="checkbox" id="gst-filed" checked={gstFiled} onChange={(e) => setGstFiled(e.target.checked)} className="h-4 w-4 rounded border-gray-300" /><Label htmlFor="gst-filed" className="text-sm text-gray-700">Vendor GST Filed</Label></div>
                  <div className="flex items-center gap-2"><input type="checkbox" id="gstr2b" checked={gstr2bReflected} onChange={(e) => setGstr2bReflected(e.target.checked)} className="h-4 w-4 rounded border-gray-300" /><Label htmlFor="gstr2b" className="text-sm text-gray-700">GSTR-2B Reflected</Label></div>
                  <div className="flex items-center gap-2"><input type="checkbox" id="itc-eligible" checked={itcEligible} onChange={(e) => setItcEligible(e.target.checked)} className="h-4 w-4 rounded border-gray-300" /><Label htmlFor="itc-eligible" className="text-sm text-gray-700">ITC Eligible</Label></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label className="text-xs font-medium text-gray-700">Portal Check Date</Label><Input type="date" className="h-9 bg-gray-50 border-gray-200" value={portalCheckDate} onChange={(e) => setPortalCheckDate(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label className="text-xs font-medium text-gray-700">Notes</Label><Input className="h-9 bg-gray-50 border-gray-200" value={complianceNotes} onChange={(e) => setComplianceNotes(e.target.value)} placeholder="Compliance notes..." /></div>
                </div>
              </div>
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center gap-2"><input type="checkbox" id="tds-applicable" checked={tdsApplicable} onChange={(e) => setTdsApplicable(e.target.checked)} className="h-4 w-4 rounded border-gray-300" /><Label htmlFor="tds-applicable" className="font-medium text-gray-700">TDS Applicable</Label></div>
                {tdsApplicable && (
                  <div className="grid grid-cols-2 gap-4 pl-6">
                    <div className="space-y-1.5"><Label className="text-xs font-medium text-gray-700">TDS Rate %</Label><select className="flex h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={tdsRate} onChange={(e) => { const rate = parseFloat(e.target.value); setTdsRate(rate); setTdsAmount(Math.round(Number(bill.totalAmount) * rate / 100 * 100) / 100); }}>{TDS_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}</select></div>
                    <div className="space-y-1.5"><Label className="text-xs font-medium text-gray-700">TDS Amount</Label><Input type="number" step="0.01" className="h-9 bg-gray-50 border-gray-200 tabular-nums" value={tdsAmount} onChange={(e) => setTdsAmount(parseFloat(e.target.value) || 0)} /></div>
                  </div>
                )}
              </div>
              <div className="flex justify-end pt-1">
                <Button size="sm" className="h-9 bg-blue-600 hover:bg-blue-700" onClick={saveCompliance} disabled={updateCompliance.isPending}>
                  {updateCompliance.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}Save Compliance
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {bill.status === "pending" && Number(bill.amountPaid) === 0 && (
        <div className="flex justify-end pb-6">
          <Button variant="outline" size="sm" className="h-9 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => { if (confirm("Delete this vendor bill?")) deleteMutation.mutate({ id: billId }); }} disabled={deleteMutation.isPending}>Delete Bill</Button>
        </div>
      )}

      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogHeader><DialogTitle>Record Payment for {bill.billNumber}</DialogTitle></DialogHeader>
        <form onSubmit={handlePaySubmit} className="space-y-4">
          <div className="text-sm text-gray-500">Balance due: <span className="font-semibold text-gray-900">{formatCurrency(Number(bill.balanceDue))}</span></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Date *</Label><Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} required className="h-9 bg-gray-50 border-gray-200" /></div>
            <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Amount *</Label><Input type="number" step="0.01" min="0.01" value={payAmount} onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)} required className="h-9 bg-gray-50 border-gray-200 tabular-nums" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Mode</Label><select className="flex h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={payMode} onChange={(e) => setPayMode(e.target.value)}>{PAYMENT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></div>
            <div className="space-y-1.5"><Label className="text-sm font-medium text-gray-700">Reference #</Label><Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="UTR / Cheque" className="h-9 bg-gray-50 border-gray-200" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" className="h-9" onClick={() => setPayDialogOpen(false)}>Cancel</Button>
            <Button type="submit" className="h-9 bg-emerald-600 hover:bg-emerald-700" disabled={recordPayment.isPending}>{recordPayment.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Record Payment</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
