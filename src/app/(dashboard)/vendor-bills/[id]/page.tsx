"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PAYMENT_MODES, TDS_RATES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, Loader2, IndianRupee, XCircle, CheckCircle, ChevronDown, ChevronUp, Save } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { AttachmentPanel } from "@/components/attachments/attachment-panel";

export default function VendorBillDetailPage() {
  const params = useParams();
  const router = useRouter();
  const billId = params.id as string;
  const { activeCompanyId } = useCompanyStore();
  const utils = trpc.useUtils();

  const { data: bill, isLoading } = trpc.vendorBill.get.useQuery(
    { id: billId },
    { enabled: !!billId }
  );

  const updateStatus = trpc.vendorBill.updateStatus.useMutation({
    onSuccess: () => utils.vendorBill.get.invalidate({ id: billId }),
  });
  const deleteMutation = trpc.vendorBill.delete.useMutation({
    onSuccess: () => router.push("/vendor-bills"),
  });

  // Payment dialog
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payDate, setPayDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [payAmount, setPayAmount] = useState(0);
  const [payMode, setPayMode] = useState("bank_transfer");
  const [payRef, setPayRef] = useState("");

  const recordPayment = trpc.vendorBill.recordPayment.useMutation({
    onSuccess: () => {
      utils.vendorBill.get.invalidate({ id: billId });
      utils.payment.list.invalidate();
      setPayDialogOpen(false);
    },
  });

  // Compliance state
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

  const updateCompliance = trpc.vendorBill.updateCompliance.useMutation({
    onSuccess: () => utils.vendorBill.get.invalidate({ id: billId }),
  });

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
    recordPayment.mutate({
      companyId: activeCompanyId,
      vendorBillId: billId,
      paymentDate: payDate,
      amount: payAmount,
      paymentMode: payMode,
      referenceNumber: payRef || null,
    });
  }

  function saveCompliance() {
    updateCompliance.mutate({
      id: billId,
      tdsApplicable,
      tdsRate: tdsApplicable ? tdsRate : null,
      tdsAmount: tdsApplicable ? tdsAmount : 0,
      gstFiled,
      gstr2bReflected,
      portalCheckDate: portalCheckDate || null,
      itcEligible,
      complianceNotes: complianceNotes || null,
    });
  }

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!bill) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Vendor bill not found.</p>
        <Link href="/vendor-bills"><Button variant="outline" className="mt-4">Back</Button></Link>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    partially_paid: "bg-blue-100 text-blue-700",
    paid: "bg-green-100 text-green-700",
    cancelled: "bg-gray-100 text-gray-500",
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/vendor-bills"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{bill.billNumber}</h1>
          <p className="text-sm text-muted-foreground">{bill.vendor.name}</p>
        </div>
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[bill.status] ?? ""}`}>
          {bill.status.replace("_", " ")}
        </span>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {(bill.status === "pending" || bill.status === "partially_paid") && (
          <>
            <Button size="sm" onClick={openPayDialog}>
              <IndianRupee className="h-4 w-4 mr-1" /> Record Payment
            </Button>
            <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: billId, status: "paid" })} disabled={updateStatus.isPending}>
              <CheckCircle className="h-4 w-4 mr-1" /> Mark Paid
            </Button>
          </>
        )}
        {bill.status !== "cancelled" && bill.status !== "paid" && (
          <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: billId, status: "cancelled" })} disabled={updateStatus.isPending}>
            <XCircle className="h-4 w-4 mr-1" /> Cancel
          </Button>
        )}
      </div>

      {/* Bill details */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex justify-between text-sm">
            <div>
              <p className="font-semibold">{bill.vendor.name}</p>
              {bill.vendor.gstin && <p className="font-mono text-xs">GSTIN: {bill.vendor.gstin}</p>}
            </div>
            <div className="text-right space-y-0.5">
              <p><span className="text-muted-foreground">Bill Date:</span> {formatDate(bill.billDate)}</p>
              <p><span className="text-muted-foreground">Due Date:</span> {formatDate(bill.dueDate)}</p>
            </div>
          </div>

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
                {bill.lines.map((line, idx) => (
                  <tr key={line.id} className="border-b">
                    <td className="py-2 pr-2 text-muted-foreground">{idx + 1}</td>
                    <td className="py-2 pr-2">{line.description}</td>
                    <td className="py-2 pr-2 font-mono text-xs">{line.hsnSacCode || "—"}</td>
                    <td className="py-2 pr-2 text-right">{Number(line.quantity)} {line.unit}</td>
                    <td className="py-2 pr-2 text-right">{formatCurrency(Number(line.rate))}</td>
                    <td className="py-2 pr-2 text-right">{Number(line.gstRate)}%</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(Number(line.lineTotal))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(Number(bill.subtotal))}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{formatCurrency(Number(bill.cgstAmount) + Number(bill.sgstAmount) + Number(bill.igstAmount))}</span></div>
              <div className="border-t pt-1 flex justify-between font-bold text-base"><span>Total</span><span>{formatCurrency(Number(bill.totalAmount))}</span></div>
              {Number(bill.amountPaid) > 0 && (
                <>
                  <div className="flex justify-between text-green-600"><span>Paid</span><span>-{formatCurrency(Number(bill.amountPaid))}</span></div>
                  <div className="border-t pt-1 flex justify-between font-bold text-base"><span>Balance Due</span><span>{formatCurrency(Number(bill.balanceDue))}</span></div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment history */}
      {bill.payments && bill.payments.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-lg">Payment History</CardTitle></CardHeader>
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
                {bill.payments.map((p) => (
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
      <AttachmentPanel entityType="vendor_bill" entityId={billId} />

      {/* GST & TDS Compliance */}
      {bill.status !== "cancelled" && (
        <Card>
          <CardHeader className="pb-2 cursor-pointer" onClick={() => setComplianceOpen(!complianceOpen)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">GST & TDS Compliance</CardTitle>
              {complianceOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </CardHeader>
          {complianceOpen && (
            <CardContent className="space-y-4">
              {/* GST compliance */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">GST Compliance</p>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="gst-filed" checked={gstFiled} onChange={(e) => setGstFiled(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                    <Label htmlFor="gst-filed" className="text-sm">Vendor GST Filed</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="gstr2b" checked={gstr2bReflected} onChange={(e) => setGstr2bReflected(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                    <Label htmlFor="gstr2b" className="text-sm">GSTR-2B Reflected</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="itc-eligible" checked={itcEligible} onChange={(e) => setItcEligible(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                    <Label htmlFor="itc-eligible" className="text-sm">ITC Eligible</Label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Portal Check Date</Label>
                    <Input type="date" className="h-9" value={portalCheckDate} onChange={(e) => setPortalCheckDate(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Notes</Label>
                    <Input className="h-9" value={complianceNotes} onChange={(e) => setComplianceNotes(e.target.value)} placeholder="Compliance notes..." />
                  </div>
                </div>
              </div>

              {/* TDS */}
              <div className="border-t pt-3 space-y-3">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="tds-applicable" checked={tdsApplicable} onChange={(e) => setTdsApplicable(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                  <Label htmlFor="tds-applicable" className="font-medium">TDS Applicable</Label>
                </div>
                {tdsApplicable && (
                  <div className="grid grid-cols-2 gap-3 pl-6">
                    <div className="space-y-1">
                      <Label className="text-xs">TDS Rate %</Label>
                      <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm" value={tdsRate} onChange={(e) => {
                        const rate = parseFloat(e.target.value);
                        setTdsRate(rate);
                        setTdsAmount(Math.round(Number(bill.totalAmount) * rate / 100 * 100) / 100);
                      }}>
                        {TDS_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">TDS Amount</Label>
                      <Input type="number" step="0.01" className="h-9" value={tdsAmount} onChange={(e) => setTdsAmount(parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>
                )}
              </div>

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

      {/* Delete */}
      {bill.status === "pending" && Number(bill.amountPaid) === 0 && (
        <div className="flex justify-end pb-6">
          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => { if (confirm("Delete this vendor bill?")) deleteMutation.mutate({ id: billId }); }}
            disabled={deleteMutation.isPending}
          >Delete Bill</Button>
        </div>
      )}

      {/* Payment Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogHeader><DialogTitle>Record Payment for {bill.billNumber}</DialogTitle></DialogHeader>
        <form onSubmit={handlePaySubmit} className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Balance due: <span className="font-medium text-foreground">{formatCurrency(Number(bill.balanceDue))}</span>
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
