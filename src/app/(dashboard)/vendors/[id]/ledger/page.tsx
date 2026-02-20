"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, Loader2, Download } from "lucide-react";
import Link from "next/link";

export default function VendorLedgerPage() {
  const params = useParams();
  const vendorId = params.id as string;
  const { activeCompanyId } = useCompanyStore();

  const { data, isLoading } = trpc.ledger.vendorLedger.useQuery(
    { companyId: activeCompanyId!, vendorId },
    { enabled: !!activeCompanyId && !!vendorId }
  );

  function downloadCsv() {
    if (!data) return;
    const rows = [
      ["Date", "Description", "Debit (Payment)", "Credit (Bill)", "Balance"],
      ["", "Opening Balance", "", "", data.openingBalance.toFixed(2)],
      ...data.entries.map((e) => [
        formatDate(e.date),
        e.description,
        e.debit > 0 ? e.debit.toFixed(2) : "",
        e.credit > 0 ? e.credit.toFixed(2) : "",
        e.balance.toFixed(2),
      ]),
      ["", "Closing Balance", "", "", data.closingBalance.toFixed(2)],
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.vendor.name.replace(/\s+/g, "_")}_ledger.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!activeCompanyId) return null;

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16 text-muted-foreground">Vendor not found.</div>
    );
  }

  const totalDebit = data.entries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredit = data.entries.reduce((sum, e) => sum + e.credit, 0);

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/vendors">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Vendor Ledger</h1>
          <p className="text-sm text-muted-foreground">{data.vendor.name}</p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadCsv}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Opening Balance</p>
            <p className="text-lg font-bold">{formatCurrency(data.openingBalance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Billed</p>
            <p className="text-lg font-bold">{formatCurrency(totalCredit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Paid</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(totalDebit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Amount Payable</p>
            <p className={`text-lg font-bold ${data.closingBalance > 0 ? "text-red-600" : "text-green-600"}`}>
              {formatCurrency(data.closingBalance)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ledger table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Transaction History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="p-3 font-medium">Date</th>
                  <th className="p-3 font-medium">Description</th>
                  <th className="p-3 font-medium text-right">Debit (Paid)</th>
                  <th className="p-3 font-medium text-right">Credit (Bill)</th>
                  <th className="p-3 font-medium text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {/* Opening balance row */}
                <tr className="border-b bg-muted/30">
                  <td className="p-3 text-muted-foreground">—</td>
                  <td className="p-3 font-medium">Opening Balance</td>
                  <td className="p-3 text-right">—</td>
                  <td className="p-3 text-right">—</td>
                  <td className="p-3 text-right font-medium">{formatCurrency(data.openingBalance)}</td>
                </tr>
                {data.entries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      No transactions found.
                    </td>
                  </tr>
                ) : (
                  data.entries.map((entry, idx) => (
                    <tr key={`${entry.id}-${idx}`} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 text-muted-foreground">{formatDate(entry.date)}</td>
                      <td className="p-3">
                        {entry.type === "bill" ? (
                          <Link href={`/vendor-bills/${entry.id}`} className="text-primary hover:underline">
                            {entry.description}
                          </Link>
                        ) : (
                          <span className="text-green-700">{entry.description}</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-medium text-green-600">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : "—"}
                      </td>
                      <td className="p-3 text-right font-medium">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : "—"}
                      </td>
                      <td className="p-3 text-right font-medium">{formatCurrency(entry.balance)}</td>
                    </tr>
                  ))
                )}
                {/* Closing balance row */}
                <tr className="bg-muted/30 font-bold">
                  <td className="p-3">—</td>
                  <td className="p-3">Closing Balance</td>
                  <td className="p-3 text-right text-green-600">{formatCurrency(totalDebit)}</td>
                  <td className="p-3 text-right">{formatCurrency(totalCredit)}</td>
                  <td className={`p-3 text-right ${data.closingBalance > 0 ? "text-red-600" : "text-green-600"}`}>
                    {formatCurrency(data.closingBalance)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
