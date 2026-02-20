"use client";

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Upload, ArrowLeft, Loader2, CheckCircle } from "lucide-react";
import Link from "next/link";

interface ParsedRow {
  txnDate: string;
  description: string;
  narration: string;
  referenceNumber: string;
  debit: number;
  credit: number;
  balance: number;
}

interface ColumnMapping {
  date: number;
  description: number;
  debit: number;
  credit: number;
  balance: number;
  reference: number;
}

export default function BankImportPage() {
  const { activeCompanyId } = useCompanyStore();
  const [step, setStep] = useState<"upload" | "map" | "preview" | "done">("upload");
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    date: 0, description: 1, debit: 2, credit: 3, balance: 4, reference: -1,
  });
  const [bankLabel, setBankLabel] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [result, setResult] = useState<{ imported: number; skipped: number; total: number } | null>(null);

  const importMutation = trpc.bank.import.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setStep("done");
    },
  });

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) return;

      // Parse CSV (handle quoted fields)
      const parseLine = (line: string): string[] => {
        const result: string[] = [];
        let current = "";
        let inQuotes = false;
        for (const char of line) {
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === "," && !inQuotes) {
            result.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      const headers = parseLine(lines[0]);
      const rows = lines.slice(1).map(parseLine).filter((r) => r.length >= 3);

      setRawHeaders(headers);
      setRawRows(rows);

      // Auto-detect columns
      const detect = (keywords: string[]) =>
        headers.findIndex((h) =>
          keywords.some((k) => h.toLowerCase().includes(k))
        );

      setMapping({
        date: Math.max(0, detect(["date", "txn date", "value date", "transaction date"])),
        description: Math.max(0, detect(["description", "narration", "particular", "remark"])),
        debit: Math.max(0, detect(["debit", "withdrawal", "dr"])),
        credit: Math.max(0, detect(["credit", "deposit", "cr"])),
        balance: detect(["balance", "closing"]),
        reference: detect(["reference", "ref", "utr", "cheque"]),
      });

      setStep("map");
    };
    reader.readAsText(file);
  }, []);

  function applyMapping() {
    const parsed = rawRows
      .map((row) => {
        const dateStr = row[mapping.date] ?? "";
        const description = row[mapping.description] ?? "";
        const debitStr = row[mapping.debit] ?? "0";
        const creditStr = row[mapping.credit] ?? "0";
        const balanceStr = mapping.balance >= 0 ? (row[mapping.balance] ?? "0") : "0";
        const reference = mapping.reference >= 0 ? (row[mapping.reference] ?? "") : "";

        // Try to parse date
        const date = parseDate(dateStr);
        if (!date || !description) return null;

        const debit = parseFloat(debitStr.replace(/[^0-9.-]/g, "")) || 0;
        const credit = parseFloat(creditStr.replace(/[^0-9.-]/g, "")) || 0;
        const balance = parseFloat(balanceStr.replace(/[^0-9.-]/g, "")) || 0;

        return {
          txnDate: date,
          description,
          narration: description,
          referenceNumber: reference,
          debit,
          credit,
          balance,
        } as ParsedRow;
      })
      .filter(Boolean) as ParsedRow[];

    setParsedRows(parsed);
    setStep("preview");
  }

  function parseDate(str: string): string | null {
    // Try common formats: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, MM/DD/YYYY
    const cleaned = str.trim();
    if (!cleaned) return null;

    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;

    // DD/MM/YYYY or DD-MM-YYYY
    const dmy = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmy) {
      const [, d, m, y] = dmy;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }

    // Try native parse as fallback
    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }

    return null;
  }

  function handleImport() {
    if (!activeCompanyId || parsedRows.length === 0) return;
    importMutation.mutate({
      companyId: activeCompanyId,
      bankAccountLabel: bankLabel || undefined,
      rows: parsedRows,
    });
  }

  if (!activeCompanyId) return null;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/payments">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold">Import Bank Statement</h1>
      </div>

      {/* Step 1: Upload CSV */}
      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upload CSV File</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Download your bank statement as CSV and upload it here. We support most Indian bank formats.
            </p>
            <div className="space-y-2">
              <Label>Bank Account Label (optional)</Label>
              <Input
                value={bankLabel}
                onChange={(e) => setBankLabel(e.target.value)}
                placeholder="e.g. SBI Current A/c"
              />
            </div>
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <Label htmlFor="csv-upload" className="cursor-pointer">
                <span className="text-primary hover:underline font-medium">Choose CSV file</span>
                <Input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </Label>
              <p className="text-xs text-muted-foreground mt-1">.csv files only</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Map columns */}
      {step === "map" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Map Columns</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Found {rawRows.length} rows. Map the columns to the right fields.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(["date", "description", "debit", "credit", "balance", "reference"] as const).map((field) => (
                <div key={field} className="space-y-1">
                  <Label className="capitalize">{field} {field !== "balance" && field !== "reference" ? "*" : ""}</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={mapping[field]}
                    onChange={(e) => setMapping({ ...mapping, [field]: parseInt(e.target.value) })}
                  >
                    <option value={-1}>— skip —</option>
                    {rawHeaders.map((h, i) => (
                      <option key={i} value={i}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Preview first 3 rows */}
            <div className="text-xs font-mono overflow-x-auto">
              <p className="text-muted-foreground mb-1">Preview (first 3 rows):</p>
              <table className="text-left">
                <thead>
                  <tr>
                    {rawHeaders.map((h, i) => (
                      <th key={i} className="pr-4 pb-1 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rawRows.slice(0, 3).map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} className="pr-4 text-muted-foreground">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setStep("upload")}>Back</Button>
              <Button onClick={applyMapping}>Continue</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview parsed data */}
      {step === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preview Import</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {parsedRows.length} transactions ready to import. Duplicates will be automatically skipped.
            </p>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Description</th>
                    <th className="py-2 pr-3 font-medium text-right">Debit</th>
                    <th className="py-2 pr-3 font-medium text-right">Credit</th>
                    <th className="py-2 font-medium text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 50).map((row, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-1.5 pr-3 font-mono text-xs">{row.txnDate}</td>
                      <td className="py-1.5 pr-3 max-w-[200px] truncate">{row.description}</td>
                      <td className="py-1.5 pr-3 text-right text-red-600">
                        {row.debit > 0 ? formatCurrency(row.debit) : ""}
                      </td>
                      <td className="py-1.5 pr-3 text-right text-green-600">
                        {row.credit > 0 ? formatCurrency(row.credit) : ""}
                      </td>
                      <td className="py-1.5 text-right">
                        {row.balance ? formatCurrency(row.balance) : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedRows.length > 50 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  ...and {parsedRows.length - 50} more rows
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setStep("map")}>Back</Button>
              <Button onClick={handleImport} disabled={importMutation.isPending}>
                {importMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Import {parsedRows.length} Transactions
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Done */}
      {step === "done" && result && (
        <Card>
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
            <div>
              <p className="text-lg font-medium">Import Complete</p>
              <p className="text-sm text-muted-foreground mt-1">
                {result.imported} transactions imported, {result.skipped} duplicates skipped.
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={() => { setStep("upload"); setResult(null); }}>
                Import More
              </Button>
              <Link href="/banking/reconcile">
                <Button>Go to Reconciliation</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
