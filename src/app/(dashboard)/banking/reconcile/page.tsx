"use client";

import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft, Loader2, Link2, EyeOff, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function ReconcilePage() {
  const { activeCompanyId } = useCompanyStore();
  const utils = trpc.useUtils();

  const { data: suggestions, isLoading } = trpc.bank.suggestMatches.useQuery(
    { companyId: activeCompanyId! },
    { enabled: !!activeCompanyId }
  );

  // Also show unmatched txns with no suggestions
  const { data: allUnmatched } = trpc.bank.list.useQuery(
    { companyId: activeCompanyId!, status: "unmatched" },
    { enabled: !!activeCompanyId }
  );

  const matchMutation = trpc.bank.match.useMutation({
    onSuccess: () => {
      utils.bank.suggestMatches.invalidate();
      utils.bank.list.invalidate();
      utils.invoice.list.invalidate();
      utils.payment.list.invalidate();
    },
  });

  const ignoreMutation = trpc.bank.ignore.useMutation({
    onSuccess: () => {
      utils.bank.suggestMatches.invalidate();
      utils.bank.list.invalidate();
    },
  });

  // Unmatched txns that have NO suggestions
  const suggestedTxnIds = new Set(suggestions?.map((s) => s.transaction.id) ?? []);
  const noSuggestionTxns = allUnmatched?.filter((t) => !suggestedTxnIds.has(t.id) && Number(t.credit) > 0) ?? [];

  if (!activeCompanyId) return null;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/payments">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-2xl font-bold">Bank Reconciliation</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        We match incoming bank credits against your unpaid invoices using amount, customer name, and invoice number.
      </p>

      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Suggested matches */}
      {!isLoading && suggestions && suggestions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Suggested Matches ({suggestions.length})</h2>
          {suggestions.map((suggestion) => {
            const txn = suggestion.transaction;
            return (
              <Card key={txn.id}>
                <CardContent className="p-4 space-y-3">
                  {/* Bank transaction info */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{txn.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(txn.txnDate)}
                        {txn.referenceNumber && <> &middot; Ref: {txn.referenceNumber}</>}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">
                        {formatCurrency(Number(txn.credit))}
                      </p>
                    </div>
                  </div>

                  {/* Candidate invoices */}
                  <div className="border-t pt-2 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Possible matches:</p>
                    {suggestion.candidates.map((c) => (
                      <div
                        key={c.invoice.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pl-3 border-l-2 border-primary/30 py-1"
                      >
                        <div>
                          <p className="text-sm">
                            <span className="font-mono font-medium text-primary">{c.invoice.invoiceNumber}</span>
                            {" — "}
                            {c.invoice.customer.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Balance: {formatCurrency(Number(c.invoice.balanceDue))}
                            {" · Score: "}{c.score}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() =>
                            matchMutation.mutate({
                              bankTransactionId: txn.id,
                              invoiceId: c.invoice.id,
                              companyId: activeCompanyId,
                              amount: Math.min(Number(txn.credit), Number(c.invoice.balanceDue)),
                              paymentDate: new Date(txn.txnDate).toISOString().slice(0, 10),
                            })
                          }
                          disabled={matchMutation.isPending}
                        >
                          <Link2 className="h-3.5 w-3.5 mr-1" />
                          Match
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Ignore button */}
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      onClick={() => ignoreMutation.mutate({ id: txn.id })}
                      disabled={ignoreMutation.isPending}
                    >
                      <EyeOff className="h-3.5 w-3.5 mr-1" /> Ignore
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Unmatched with no suggestions */}
      {!isLoading && noSuggestionTxns.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">
            Unmatched Credits — No suggestions ({noSuggestionTxns.length})
          </h2>
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Description</th>
                    <th className="px-4 py-2 font-medium text-right">Credit</th>
                    <th className="px-4 py-2 font-medium w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {noSuggestionTxns.slice(0, 50).map((txn) => (
                    <tr key={txn.id} className="border-b last:border-0">
                      <td className="px-4 py-2">{formatDate(txn.txnDate)}</td>
                      <td className="px-4 py-2 max-w-[250px] truncate">{txn.description}</td>
                      <td className="px-4 py-2 text-right text-green-600 font-medium">
                        {formatCurrency(Number(txn.credit))}
                      </td>
                      <td className="px-4 py-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => ignoreMutation.mutate({ id: txn.id })}
                          disabled={ignoreMutation.isPending}
                        >
                          Ignore
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* All clear */}
      {!isLoading &&
        (!suggestions || suggestions.length === 0) &&
        noSuggestionTxns.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
              <p className="text-lg font-medium">All caught up!</p>
              <p className="text-sm text-muted-foreground mt-1">
                No unmatched bank credits. Import a statement to get started.
              </p>
              <Link href="/banking/import">
                <Button variant="outline" className="mt-4">Import Statement</Button>
              </Link>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
