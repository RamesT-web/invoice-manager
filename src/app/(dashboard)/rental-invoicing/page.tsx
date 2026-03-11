"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Building2,
  PlayCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  SkipForward,
  FileText,
  ChevronDown,
  ChevronRight,
  Download,
} from "lucide-react";

export default function RentalInvoicingPage() {
  const { activeCompanyId } = useCompanyStore();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const runsQuery = trpc.rental.listRuns.useQuery(
    { companyId: activeCompanyId! },
    { enabled: !!activeCompanyId }
  );

  const runDetailQuery = trpc.rental.getRun.useQuery(
    { id: expandedRunId! },
    { enabled: !!expandedRunId }
  );

  const generateMutation = trpc.rental.generateInvoices.useMutation({
    onSuccess: () => utils.rental.listRuns.invalidate(),
  });

  const handleGenerate = () => {
    if (!activeCompanyId || !month) return;
    generateMutation.mutate({ companyId: activeCompanyId, month });
  };

  if (!activeCompanyId) return <div className="flex items-center justify-center h-64"><p className="text-sm text-gray-500">Select a company to manage rental invoicing.</p></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Building2 className="h-5 w-5 text-blue-600" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Rental Invoicing</h1>
          <p className="text-sm text-gray-500">Generate bulk invoices for rental tenants from Google Sheets</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-5 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Generate Invoices</h2>
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
          <div className="w-full sm:w-auto">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Billing Month</label>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-9 px-3 rounded-md border border-gray-200 bg-gray-50 text-sm w-full sm:w-52 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button onClick={handleGenerate} disabled={generateMutation.isPending || !month} className="inline-flex items-center gap-2 px-5 h-9 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {generateMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Generating...</> : <><PlayCircle className="h-4 w-4" />Generate Invoices</>}
          </button>
        </div>

        {generateMutation.data && (
          <div className="mt-2 p-4 rounded-md border bg-gray-50">
            <div className="flex items-center gap-2 mb-2">
              {generateMutation.data.status === "completed" ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
              <span className="font-semibold text-gray-900 capitalize">{generateMutation.data.status}</span>
              <span className="text-sm text-gray-500">&mdash; {generateMutation.data.month}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <StatBox label="Total" value={generateMutation.data.totalClients} icon={<FileText className="h-4 w-4 text-gray-400" />} />
              <StatBox label="Success" value={generateMutation.data.successCount} icon={<CheckCircle2 className="h-4 w-4 text-green-600" />} />
              <StatBox label="Skipped" value={generateMutation.data.skippedCount} icon={<SkipForward className="h-4 w-4 text-yellow-600" />} />
              <StatBox label="Errors" value={generateMutation.data.errorCount} icon={<XCircle className="h-4 w-4 text-red-600" />} />
            </div>
            {generateMutation.data.errors.length > 0 && (
              <div className="mt-3 text-sm">
                <p className="font-medium text-red-600 mb-1">Errors:</p>
                <ul className="space-y-1">{generateMutation.data.errors.map((e, i) => <li key={i} className="text-red-600"><span className="font-medium">{e.clientName}:</span> {e.error}</li>)}</ul>
              </div>
            )}
          </div>
        )}

        {generateMutation.error && (
          <div className="mt-2 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">{generateMutation.error.message}</div>
        )}
      </div>

      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h2 className="text-sm font-semibold text-gray-900">Run History</h2>
        </div>
        {runsQuery.isLoading ? (
          <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
        ) : !runsQuery.data?.length ? (
          <div className="flex flex-col items-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-gray-50 flex items-center justify-center mb-3"><Building2 className="h-6 w-6 text-gray-300" /></div>
            <p className="text-sm text-gray-500">No invoice runs yet. Generate your first batch above.</p>
          </div>
        ) : (
          <div className="divide-y">
            {runsQuery.data.map((run) => (
              <div key={run.id}>
                <button onClick={() => setExpandedRunId(expandedRunId === run.id ? null : run.id)} className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 text-left transition-colors">
                  <span className="text-gray-400">{expandedRunId === run.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</span>
                  <span className="font-mono text-sm font-medium text-gray-900 w-20">{run.month}</span>
                  <StatusBadge status={run.status} />
                  <span className="text-xs text-gray-500 hidden sm:inline">{run.successCount} ok / {run.skippedCount} skip / {run.errorCount} err</span>
                  <span className="ml-auto text-xs text-gray-400">{formatDate(run.startedAt)}</span>
                </button>

                {expandedRunId === run.id && (
                  <div className="px-4 pb-4 bg-gray-50">
                    {runDetailQuery.isLoading ? (
                      <div className="py-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-gray-400" /></div>
                    ) : runDetailQuery.data?.invoices.length ? (
                      <div className="overflow-x-auto">
                        <table className="data-table">
                          <thead><tr><th>Invoice #</th><th>Customer</th><th className="text-right">Total</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
                          <tbody>
                            {runDetailQuery.data.invoices.map((inv) => (
                              <tr key={inv.id}>
                                <td><a href={`/invoices/${inv.id}`} className="font-mono text-xs text-blue-600 hover:text-blue-700">{inv.invoiceNumber}</a></td>
                                <td className="text-gray-900">{inv.customer?.name}</td>
                                <td className="text-right font-mono tabular-nums">{formatCurrency(Number(inv.totalAmount))}</td>
                                <td><StatusBadge status={inv.status} /></td>
                                <td className="text-right"><a href={`/invoices/${inv.id}`} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"><Download className="h-3 w-3" />View</a></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="py-4 text-center text-sm text-gray-500">
                        No invoices in this run.
                        {run.errors && (
                          <div className="mt-2 text-red-600 text-left">
                            <p className="font-medium">Errors:</p>
                            {(JSON.parse(run.errors) as Array<{ clientName: string; error: string }>).map((e, i) => <p key={i}>{e.clientName}: {e.error}</p>)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-md bg-white border">
      {icon}
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="font-semibold text-gray-900">{value}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    running: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
    sent: "bg-blue-100 text-blue-700",
    paid: "bg-green-100 text-green-700",
    draft: "bg-gray-100 text-gray-700",
    overdue: "bg-orange-100 text-orange-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${styles[status] || "bg-gray-100 text-gray-700"}`}>{status}</span>
  );
}
