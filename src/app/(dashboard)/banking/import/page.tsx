"use client";

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import {
  Upload,
  ArrowLeft,
  Loader2,
  CheckCircle,
  FileText,
  FolderOpen,
} from "lucide-react";
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
  const [mapping, setMapping] = useState<ColumnMapping>({ date: 0, description: 1, debit: 2, credit: 3, balance: 4, reference: -1 });
  const [bankLabel, setBankLabel] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [result, setResult] = useState<{ imported: number; skipped: number; total: number } | null>(null);
  const [reconcileResult, setReconcileResult] = useState<{ matched: number; skipped: number; total: number } | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const autoReconcileMutation = trpc.bank.autoReconcile.useMutation({
    onSuccess: (data) => { setReconcileResult(data); setReconciling(false); },
    onError: () => { setReconciling(false); },
  });

  const importMutation = trpc.bank.import.useMutation({
    onSuccess: (data) => {
      setImportError(null); setResult(data); setStep("done");
      if (activeCompanyId) { setReconciling(true); autoReconcileMutation.mutate({ companyId: activeCompanyId }); }
    },
    onError: (err) => { setImportError(err.message || "Import failed. Please check the data and try again."); },
  });

  const { data: bankDocs } = trpc.attachment.listDocuments.useQuery(
    { companyId: activeCompanyId!, category: "bank_statement" },
    { enabled: !!activeCompanyId }
  );

  function processHeadersAndRows(headers: string[], rows: string[][]) {
    setRawHeaders(headers);
    setRawRows(rows);
    const detectCol = (keywords: string[], excludeKeywords?: string[]) =>
      headers.findIndex((h) => { const lower = h.toLowerCase(); if (excludeKeywords?.some((ex) => lower.includes(ex))) return false; return keywords.some((k) => lower.includes(k)); });
    const skipCrDr = ["cr/dr", "dr/cr"];
    setMapping({
      date: Math.max(0, detectCol(["date", "txn date", "value date", "transaction date"])),
      description: Math.max(0, detectCol(["description", "narration", "particular", "remark"])),
      debit: Math.max(0, detectCol(["debit", "withdrawal"], skipCrDr)),
      credit: Math.max(0, detectCol(["credit", "deposit"], skipCrDr)),
      balance: detectCol(["balance", "closing"]),
      reference: detectCol(["reference", "ref", "utr", "cheque"]),
    });
    setStep("map");
  }

  async function parseFileOnServer(file: File | Blob, fileName: string) {
    setParsing(true);
    try {
      const formData = new FormData();
      formData.append("file", file, fileName);
      const res = await fetch("/api/parse-statement", { method: "POST", body: formData });
      if (!res.ok) { const err = await res.json(); alert(err.error || "Failed to parse file"); return; }
      const { headers, rows } = await res.json();
      processHeadersAndRows(headers, rows);
    } catch { alert("Failed to parse file"); }
    finally { setParsing(false); }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) parseFileOnServer(file, file.name); }, []);

  async function loadFromDocument(docId: string, fileName: string) {
    setLoadingDoc(true);
    try {
      const res = await fetch(`/api/attachments/${docId}`);
      if (!res.ok) { alert("Failed to load document"); return; }
      const blob = await res.blob();
      await parseFileOnServer(blob, fileName);
    } catch { alert("Failed to load document"); }
    finally { setLoadingDoc(false); }
  }

  function applyMapping() {
    const parsed = rawRows.map((row) => {
      const dateStr = row[mapping.date] ?? "";
      const description = row[mapping.description] ?? "";
      const debitStr = row[mapping.debit] ?? "0";
      const creditStr = row[mapping.credit] ?? "0";
      const balanceStr = mapping.balance >= 0 ? (row[mapping.balance] ?? "0") : "0";
      const reference = mapping.reference >= 0 ? (row[mapping.reference] ?? "") : "";
      const date = parseDate(dateStr);
      if (!date || !description) return null;
      const parseAmount = (str: string): number => { if (!str || str === "-" || str === "--") return 0; const cleaned = str.replace(/,/g, "").replace(/[^0-9.-]/g, ""); if (!cleaned) return 0; const val = parseFloat(cleaned); return isNaN(val) ? 0 : val; };
      const debit = parseAmount(debitStr);
      const credit = parseAmount(creditStr);
      const balance = parseAmount(balanceStr);
      const MAX_AMT = 1_000_000_000;
      if (Math.abs(debit) > MAX_AMT || Math.abs(credit) > MAX_AMT) return null;
      return { txnDate: date, description, narration: description, referenceNumber: reference, debit: Math.round(debit * 100) / 100, credit: Math.round(credit * 100) / 100, balance: Math.round(balance * 100) / 100 } as ParsedRow;
    }).filter(Boolean) as ParsedRow[];
    setParsedRows(parsed);
    setStep("preview");
  }

  function parseDate(str: string): string | null {
    const cleaned = str.trim();
    if (!cleaned) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
    const dmy = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmy) { const [, d, m, y] = dmy; return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`; }
    const dMonY = cleaned.match(/^(\d{1,2})[\s-]([A-Za-z]{3,9})[\s-](\d{4})$/);
    if (dMonY) { const [, day, mon, year] = dMonY; const d = new Date(`${mon} ${day}, ${year}`); if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10); }
    if (/^\d{5}$/.test(cleaned)) { const serial = parseInt(cleaned); if (serial > 40000 && serial < 60000) { const epoch = new Date(1899, 11, 30); const d = new Date(epoch.getTime() + serial * 86400000); if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10); } }
    const d = new Date(cleaned);
    if (!isNaN(d.getTime()) && d.getFullYear() > 2000 && d.getFullYear() < 2100) return d.toISOString().slice(0, 10);
    return null;
  }

  function handleImport() {
    if (!activeCompanyId || parsedRows.length === 0) return;
    setImportError(null);
    importMutation.mutate({
      companyId: activeCompanyId, bankAccountLabel: bankLabel || undefined,
      rows: parsedRows.map((r) => ({ ...r, narration: r.narration || null, referenceNumber: r.referenceNumber || null, balance: r.balance || null })),
    });
  }

  if (!activeCompanyId) return null;

  const supportedDocs = bankDocs?.filter((d) => { const ext = d.fileName.split(".").pop()?.toLowerCase(); return ext === "csv" || ext === "xlsx" || ext === "xls"; });

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/payments"><Button variant="ghost" size="icon" className="h-9 w-9"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-xl font-semibold text-gray-900">Import Bank Statement</h1>
      </div>

      {step === "upload" && (
        <>
          <div className="bg-white rounded-lg border p-6 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Upload Statement File</h2>
            <p className="text-sm text-gray-500">Upload your bank statement as CSV or Excel (.xlsx). We support most Indian bank formats.</p>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Bank Account Label (optional)</Label>
              <Input value={bankLabel} onChange={(e) => setBankLabel(e.target.value)} placeholder="e.g. SBI Current A/c" className="h-9 bg-gray-50 border-gray-200" />
            </div>
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:border-gray-300 transition-colors">
              {parsing ? (
                <div className="flex flex-col items-center gap-2"><Loader2 className="h-10 w-10 animate-spin text-gray-400" /><p className="text-sm text-gray-500">Parsing file...</p></div>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <Label htmlFor="file-upload" className="cursor-pointer">
                    <span className="text-blue-600 hover:text-blue-700 font-medium">Choose file</span>
                    <Input id="file-upload" type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileUpload} />
                  </Label>
                  <p className="text-xs text-gray-400 mt-1">CSV or Excel (.xlsx, .xls)</p>
                </>
              )}
            </div>
          </div>

          {supportedDocs && supportedDocs.length > 0 && (
            <div className="bg-white rounded-lg border p-6 space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 flex items-center gap-2"><FolderOpen className="h-4 w-4" />Or Pick from Uploaded Documents</h2>
              <p className="text-sm text-gray-500">Bank statements you previously uploaded in Documents are available here.</p>
              <div className="space-y-2">
                {supportedDocs.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 p-3 rounded-md border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => !loadingDoc && !parsing && loadFromDocument(doc.id, doc.fileName)}>
                    <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{doc.fileName}</p>
                      <p className="text-xs text-gray-400">Uploaded {new Date(doc.createdAt).toLocaleDateString()}</p>
                    </div>
                    <Button variant="outline" size="sm" className="h-8" disabled={loadingDoc || parsing} onClick={(e) => { e.stopPropagation(); loadFromDocument(doc.id, doc.fileName); }}>
                      {loadingDoc ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Use This"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {step === "map" && (
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Map Columns</h2>
          <p className="text-sm text-gray-500">Found {rawRows.length} rows. Map the columns to the right fields.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(["date", "description", "debit", "credit", "balance", "reference"] as const).map((field) => (
              <div key={field} className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700 capitalize">{field} {field !== "balance" && field !== "reference" ? "*" : ""}</Label>
                <select className="flex h-9 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={mapping[field]} onChange={(e) => setMapping({ ...mapping, [field]: parseInt(e.target.value) })}>
                  <option value={-1}>&mdash; skip &mdash;</option>
                  {rawHeaders.map((h, i) => <option key={i} value={i}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>

          <div className="text-xs font-mono overflow-x-auto bg-gray-50 rounded-md p-3 border">
            <p className="text-gray-500 mb-1 font-sans text-xs font-medium">Preview (first 3 rows):</p>
            <table className="text-left">
              <thead><tr>{rawHeaders.map((h, i) => <th key={i} className="pr-4 pb-1 font-medium text-gray-700">{h}</th>)}</tr></thead>
              <tbody>{rawRows.slice(0, 3).map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className="pr-4 text-gray-500">{cell}</td>)}</tr>)}</tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" className="h-9" onClick={() => setStep("upload")}>Back</Button>
            <Button className="h-9 bg-blue-600 hover:bg-blue-700" onClick={applyMapping}>Continue</Button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Preview Import</h2>
          <p className="text-sm text-gray-500">{parsedRows.length} transactions ready to import. Duplicates will be automatically skipped.</p>
          <div className="overflow-x-auto max-h-80 overflow-y-auto border rounded-md">
            <table className="data-table">
              <thead className="sticky top-0 bg-white"><tr><th>Date</th><th>Description</th><th className="text-right">Debit</th><th className="text-right">Credit</th><th className="text-right">Balance</th></tr></thead>
              <tbody>
                {parsedRows.slice(0, 50).map((row, i) => (
                  <tr key={i}>
                    <td className="font-mono text-xs">{row.txnDate}</td>
                    <td className="max-w-[200px] truncate">{row.description}</td>
                    <td className="text-right text-red-600 tabular-nums">{row.debit > 0 ? formatCurrency(row.debit) : ""}</td>
                    <td className="text-right text-green-600 tabular-nums">{row.credit > 0 ? formatCurrency(row.credit) : ""}</td>
                    <td className="text-right tabular-nums">{row.balance ? formatCurrency(row.balance) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsedRows.length > 50 && <p className="text-xs text-gray-400 text-center py-2">...and {parsedRows.length - 50} more rows</p>}
          </div>
          {importError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-md p-3 text-sm">{importError}</div>}
          <div className="flex justify-end gap-3">
            <Button variant="outline" className="h-9" onClick={() => setStep("map")}>Back</Button>
            <Button className="h-9 bg-blue-600 hover:bg-blue-700" onClick={handleImport} disabled={importMutation.isPending}>
              {importMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Import {parsedRows.length} Transactions
            </Button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="bg-white rounded-lg border p-8 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-green-50 flex items-center justify-center mx-auto"><CheckCircle className="h-8 w-8 text-green-600" /></div>
          <div>
            <p className="text-lg font-semibold text-gray-900">Import Complete</p>
            <p className="text-sm text-gray-500 mt-1">{result.imported} transactions imported, {result.skipped} duplicates skipped.</p>
          </div>
          {reconciling && <div className="flex items-center justify-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Auto-reconciling with invoices...</div>}
          {reconcileResult && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-left max-w-sm mx-auto">
              <p className="font-medium text-blue-800">Auto-Reconciliation</p>
              <p className="text-blue-700 mt-1">
                {reconcileResult.matched > 0 ? <>{reconcileResult.matched} invoice{reconcileResult.matched !== 1 ? "s" : ""} matched and marked as paid automatically.</> : <>No exact invoice matches found. Review manually in Reconciliation.</>}
              </p>
            </div>
          )}
          <div className="flex justify-center gap-3">
            <Button variant="outline" className="h-9" onClick={() => { setStep("upload"); setResult(null); setReconcileResult(null); }}>Import More</Button>
            <Link href="/banking/reconcile"><Button className="h-9 bg-blue-600 hover:bg-blue-700">Go to Reconciliation</Button></Link>
          </div>
        </div>
      )}
    </div>
  );
}
