"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, Loader2, Link2, EyeOff, CheckCircle, Zap } from "lucide-react";
import Link from "next/link";

export default function ReconcilePage() {
  const { activeCompanyId } = useCompanyStore();
  const utils = trpc.useUtils();
  const [autoResult, setAutoResult] = useState<{ matched: number; skipped: number; total: number } | null>(null);

  const { data: suggestions, isLoading } = trpc.bank.suggestMatches.useQuery(
    { companyId: activeCompanyId! },
    { enabled: !!activeCompanyId }
  );
  const { data: allUnmatched } = trpc.bank.list.useQuery(
    { companyId: activeCompanyId!, status: "unmatched" },
    { enabled: !!activeCompanyId }
  );

  const matchMutation = trpc.bank.match.useMutation({
    onSuccess: () => { utils.bank.suggestMatches.invalidate(); utils.bank.list.invalidate(); utils.invoice.list.invalidate(); utils.payment.list.invalidate(); },
  });
  const ignoreMutation = trpc.bank.ignore.useMutation({
    onSuccess: () => { utils.bank.suggestMatches.invalidate(); utils.bank.list.invalidate(); },
  });
  const autoReconcileMutation = trpc.bank.autoReconcile.useMutation({
    onSuccess: (data) => { setAutoResult(data); utils.bank.suggestMatches.invalidate(); utils.bank.list.invalidate(); utils.invoice.list.invalidate(); utils.payment.list.invalidate(); },
  });

  const suggestedTxnIds = new Set(suggestions?.map((s) => s.transaction.id) ?? []);
  const noSuggestionTxns = allUnmatched?.filter((t) => !suggestedTxnIds.has(t.id) && Number(t.credit) > 0) ?? [];
  const totalUnmatched = allUnmatched?.filter((t) => Number(t.credit) > 0).length ?? 0;

  if (!activeCompanyId) return null;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/payments"><Button variant="ghost" size="icon" className="h-9 w-9"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-xl font-semibold text-gray-900">Bank Reconciliation</h1>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-gray-500">Match incoming bank credits against your unpaid invoices.</p>
        {totalUnmatched > 0 && (
          <Button size="sm" className="h-9 bg-blue-600 hover:bg-blue-700 shrink-0" onClick={() => { setAutoResult(null); autoReconcileMutation.mutate({ companyId: activeCompanyId }); }} disabled={autoReconcileMutation.isPending}>
            {autoReconcileMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
            Auto-Reconcile
          </Button>
        )}
      </div>

      {autoResult && (
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-900">Auto-reconciliation complete</p>
              <p className="text-sm text-gray-500">{autoResult.matched} transaction{autoResult.matched !== 1 ? "s" : ""} matched automatically.{autoResult.skipped > 0 && <> {autoResult.skipped} skipped (low confidence).</>}</p>
            </div>
            <Button variant="ghost" size="sm" className="ml-auto h-8" onClick={() => setAutoResult(null)}>Dismiss</Button>
          </div>
        </div>
      )}

      {isLoading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>}

      {!isLoading && suggestions && suggestions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Suggested Matches ({suggestions.length})</h2>
          {suggestions.map((suggestion) => {
            const txn = suggestion.transaction;
            return (
              <div key={txn.id} className="bg-white rounded-lg border p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{txn.description}</p>
                    <p className="text-xs text-gray-400">{formatDate(txn.txnDate)}{txn.referenceNumber && <> &middot; Ref: {txn.referenceNumber}</>}</p>
                  </div>
                  <div className="text-right"><p className="text-lg font-bold text-green-600 tabular-nums">{formatCurrency(Number(txn.credit))}</p></div>
                </div>

                <div className="border-t border-gray-100 pt-2 space-y-2">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Possible matches:</p>
                  {suggestion.candidates.map((c) => (
                    <div key={c.invoice.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pl-3 border-l-2 border-blue-200 py-1">
                      <div>
                        <p className="text-sm"><span className="font-mono font-medium text-blue-600">{c.invoice.invoiceNumber}</span> &mdash; {c.invoice.customer.name}</p>
                        <p className="text-xs text-gray-400">Balance: {formatCurrency(Number(c.invoice.balanceDue))} &middot; Score: {c.score}</p>
                      </div>
                      <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700" onClick={() => matchMutation.mutate({ bankTransactionId: txn.id, invoiceId: c.invoice.id, companyId: activeCompanyId, amount: Math.min(Number(txn.credit), Number(c.invoice.balanceDue)), paymentDate: new Date(txn.txnDate).toISOString().slice(0, 10) })} disabled={matchMutation.isPending}>
                        <Link2 className="h-3.5 w-3.5 mr-1" />Match
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-600 h-8" onClick={() => ignoreMutation.mutate({ id: txn.id })} disabled={ignoreMutation.isPending}><EyeOff className="h-3.5 w-3.5 mr-1" />Ignore</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && noSuggestionTxns.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Unmatched Credits &mdash; No suggestions ({noSuggestionTxns.length})</h2>
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Description</th><th className="text-right">Credit</th><th className="w-20"></th></tr></thead>
              <tbody>
                {noSuggestionTxns.slice(0, 50).map((txn) => (
                  <tr key={txn.id}>
                    <td className="text-gray-500">{formatDate(txn.txnDate)}</td>
                    <td className="max-w-[250px] truncate text-gray-900">{txn.description}</td>
                    <td className="text-right text-green-600 font-semibold tabular-nums">{formatCurrency(Number(txn.credit))}</td>
                    <td><Button variant="ghost" size="sm" className="text-xs h-7 text-gray-400" onClick={() => ignoreMutation.mutate({ id: txn.id })} disabled={ignoreMutation.isPending}>Ignore</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isLoading && (!suggestions || suggestions.length === 0) && noSuggestionTxns.length === 0 && (
        <div className="bg-white rounded-lg border">
          <div className="flex flex-col items-center py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-green-50 flex items-center justify-center mb-4"><CheckCircle className="h-8 w-8 text-green-600" /></div>
            <h2 className="text-base font-semibold text-gray-900 mb-1">All caught up!</h2>
            <p className="text-sm text-gray-500">No unmatched bank credits. Import a statement to get started.</p>
            <Link href="/banking/import"><Button variant="outline" className="mt-4 h-9">Import Statement</Button></Link>
          </div>
        </div>
      )}
    </div>
  );
}
