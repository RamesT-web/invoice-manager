"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, Loader2, Download } from "lucide-react";
import Link from "next/link";

export default function CustomerLedgerPage() {
  const params = useParams();
  const customerId = params.id as string;
  const { activeCompanyId } = useCompanyStore();

  const { data, isLoading } = trpc.ledger.customerLedger.useQuery(
    { companyId: activeCompanyId!, customerId },
    { enabled: !!activeCompanyId && !!customerId }
  );

  function downloadCsv() {
    if (!data) return;
    const rows = [
      ["Date", "Description", "Debit (Invoice)", "Credit (Payment)", "Balance"],
      ["", "Opening Balance", "", "", data.openingBalance.toFixed(2)],
      ...data.entries.map((e) => [formatDate(e.date), e.description, e.debit > 0 ? e.debit.toFixed(2) : "", e.credit > 0 ? e.credit.toFixed(2) : "", e.balance.toFixed(2)]),
      ["", "Closing Balance", "", "", data.closingBalance.toFixed(2)],
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${data.customer.name.replace(/\s+/g, "_")}_ledger.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  if (!activeCompanyId) return null;
  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;
  if (!data) return <div className="text-center py-16 text-sm text-gray-500">Customer not found.</div>;

  const totalDebit = data.entries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredit = data.entries.reduce((sum, e) => sum + e.credit, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/customers"><Button variant="ghost" size="icon" className="h-9 w-9"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-gray-900">Customer Ledger</h1>
          <p className="text-sm text-gray-500">{data.customer.name}</p>
        </div>
        <Button variant="outline" size="sm" className="h-9" onClick={downloadCsv}><Download className="h-4 w-4 mr-1.5" />Export CSV</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500 font-medium">Opening Balance</p>
          <p className="text-lg font-bold text-gray-900 tabular-nums">{formatCurrency(data.openingBalance)}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500 font-medium">Total Invoiced</p>
          <p className="text-lg font-bold text-gray-900 tabular-nums">{formatCurrency(totalDebit)}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500 font-medium">Total Received</p>
          <p className="text-lg font-bold text-green-600 tabular-nums">{formatCurrency(totalCredit)}</p>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <p className="text-xs text-gray-500 font-medium">Closing Balance</p>
          <p className={`text-lg font-bold tabular-nums ${data.closingBalance > 0 ? "text-red-600" : "text-green-600"}`}>{formatCurrency(data.closingBalance)}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-sm font-semibold text-gray-900">Transaction History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Description</th><th className="text-right">Debit</th><th className="text-right">Credit</th><th className="text-right">Balance</th></tr></thead>
            <tbody>
              <tr className="bg-gray-50">
                <td className="text-gray-400">&mdash;</td>
                <td className="font-medium text-gray-900">Opening Balance</td>
                <td className="text-right">&mdash;</td>
                <td className="text-right">&mdash;</td>
                <td className="text-right font-semibold tabular-nums">{formatCurrency(data.openingBalance)}</td>
              </tr>
              {data.entries.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-gray-500">No transactions found.</td></tr>
              ) : (
                data.entries.map((entry, idx) => (
                  <tr key={`${entry.id}-${idx}`}>
                    <td className="text-gray-500">{formatDate(entry.date)}</td>
                    <td>{entry.type === "invoice" ? <Link href={`/invoices/${entry.id}`} className="text-blue-600 hover:text-blue-700">{entry.description}</Link> : <span className="text-green-700">{entry.description}</span>}</td>
                    <td className="text-right font-medium tabular-nums">{entry.debit > 0 ? formatCurrency(entry.debit) : "\u2014"}</td>
                    <td className="text-right font-medium text-green-600 tabular-nums">{entry.credit > 0 ? formatCurrency(entry.credit) : "\u2014"}</td>
                    <td className="text-right font-medium tabular-nums">{formatCurrency(entry.balance)}</td>
                  </tr>
                ))
              )}
              <tr className="bg-gray-50 font-bold border-t-2 border-gray-900">
                <td>&mdash;</td>
                <td className="text-gray-900">Closing Balance</td>
                <td className="text-right tabular-nums">{formatCurrency(totalDebit)}</td>
                <td className="text-right text-green-600 tabular-nums">{formatCurrency(totalCredit)}</td>
                <td className={`text-right tabular-nums ${data.closingBalance > 0 ? "text-red-600" : "text-green-600"}`}>{formatCurrency(data.closingBalance)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
