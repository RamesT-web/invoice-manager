"use client";

import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { INVOICE_STATUSES } from "@/lib/constants";
import {
  IndianRupee,
  AlertTriangle,
  TrendingUp,
  FileText,
  Clock,
  Shield,
  CalendarClock,
  Landmark,
  ShoppingCart,
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { activeCompanyId } = useCompanyStore();

  const { data, isLoading } = trpc.dashboard.summary.useQuery(
    { companyId: activeCompanyId! },
    { enabled: !!activeCompanyId }
  );

  const { data: reminders } = trpc.dashboard.reminders.useQuery(
    { companyId: activeCompanyId! },
    { enabled: !!activeCompanyId }
  );

  if (!activeCompanyId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Select a company to get started.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-20 animate-pulse bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Receivable</p>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(data?.totalReceivable ?? 0)}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <IndianRupee className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold mt-1 text-red-600">
                  {formatCurrency(data?.overdueAmount ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {data?.overdueCount ?? 0} invoices
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Paid This Month</p>
                <p className="text-2xl font-bold mt-1 text-green-600">
                  {formatCurrency(data?.paidThisMonth ?? 0)}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Invoices</p>
                <p className="text-2xl font-bold mt-1">{data?.totalInvoices ?? 0}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                <FileText className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Invoices */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Recent Invoices</CardTitle>
            <Link
              href="/invoices"
              className="text-sm text-primary hover:underline"
            >
              View all
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {data?.recentInvoices && data.recentInvoices.length > 0 ? (
            <div className="space-y-3">
              {data.recentInvoices.map((invoice) => {
                const statusConfig = INVOICE_STATUSES.find(
                  (s) => s.value === invoice.status
                );
                return (
                  <Link
                    key={invoice.id}
                    href={`/invoices/${invoice.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-sm font-medium">
                          {invoice.invoiceNumber}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {invoice.customer.name}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <p className="text-sm font-medium">
                          {formatCurrency(
                            typeof invoice.totalAmount === "object"
                              ? (invoice.totalAmount as { toNumber: () => number }).toNumber()
                              : Number(invoice.totalAmount)
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(invoice.invoiceDate)}
                        </p>
                      </div>
                      <Badge
                        className={statusConfig?.color ?? "bg-gray-100 text-gray-700"}
                        variant="secondary"
                      >
                        {statusConfig?.label ?? invoice.status}
                      </Badge>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No invoices yet.</p>
              <Link
                href="/invoices/new"
                className="text-primary hover:underline text-sm mt-1 inline-block"
              >
                Create your first invoice
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Reminders Section */}
      {reminders && (
        (reminders.overdueInvoices.length > 0 ||
         reminders.pendingTdsCerts.length > 0 ||
         reminders.upcomingFollowUps.length > 0 ||
         reminders.unmatchedBankTxns > 0 ||
         reminders.overdueVendorBills.length > 0 ||
         reminders.unfiledGstBills > 0) && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              Reminders
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Overdue Invoices */}
              {reminders.overdueInvoices.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-red-600 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4" />
                      Overdue ({reminders.overdueInvoices.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {reminders.overdueInvoices.slice(0, 5).map((inv) => (
                      <Link
                        key={inv.id}
                        href={`/invoices/${inv.id}`}
                        className="flex items-center justify-between py-1.5 hover:bg-muted/50 rounded px-2 -mx-2"
                      >
                        <div>
                          <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                          <p className="text-xs text-muted-foreground">{inv.customer.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-red-600">{formatCurrency(Number(inv.balanceDue))}</p>
                          <p className="text-xs text-muted-foreground">Due {formatDate(inv.dueDate)}</p>
                        </div>
                      </Link>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Pending TDS Certificates */}
              {reminders.pendingTdsCerts.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-orange-600 flex items-center gap-1.5">
                      <Shield className="h-4 w-4" />
                      Pending TDS Certificates ({reminders.pendingTdsCerts.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {reminders.pendingTdsCerts.slice(0, 5).map((inv) => (
                      <Link
                        key={inv.id}
                        href={`/invoices/${inv.id}`}
                        className="flex items-center justify-between py-1.5 hover:bg-muted/50 rounded px-2 -mx-2"
                      >
                        <div>
                          <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                          <p className="text-xs text-muted-foreground">{inv.customer.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{formatCurrency(Number(inv.tdsAmount))}</p>
                          <p className="text-xs text-muted-foreground capitalize">{inv.tdsCertificateStatus}</p>
                        </div>
                      </Link>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Upcoming Follow-ups */}
              {reminders.upcomingFollowUps.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-blue-600 flex items-center gap-1.5">
                      <CalendarClock className="h-4 w-4" />
                      Upcoming Follow-ups ({reminders.upcomingFollowUps.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {reminders.upcomingFollowUps.slice(0, 5).map((inv) => (
                      <Link
                        key={inv.id}
                        href={`/invoices/${inv.id}`}
                        className="flex items-center justify-between py-1.5 hover:bg-muted/50 rounded px-2 -mx-2"
                      >
                        <div>
                          <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                          <p className="text-xs text-muted-foreground">{inv.customer.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{formatCurrency(Number(inv.balanceDue))}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(inv.nextFollowUpDate!)}</p>
                          {inv.followUpNotes && (
                            <p className="text-xs text-muted-foreground truncate max-w-[150px]">{inv.followUpNotes}</p>
                          )}
                        </div>
                      </Link>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Unmatched Bank Transactions */}
              {reminders.unmatchedBankTxns > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-purple-600 flex items-center gap-1.5">
                      <Landmark className="h-4 w-4" />
                      Bank Reconciliation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">
                      <span className="font-bold text-lg">{reminders.unmatchedBankTxns}</span>{" "}
                      unmatched bank credits need review.
                    </p>
                    <Link href="/banking/reconcile" className="text-sm text-primary hover:underline mt-1 inline-block">
                      Go to Reconciliation
                    </Link>
                  </CardContent>
                </Card>
              )}

              {/* Overdue Vendor Bills */}
              {reminders.overdueVendorBills.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-red-600 flex items-center gap-1.5">
                      <ShoppingCart className="h-4 w-4" />
                      Overdue Vendor Bills ({reminders.overdueVendorBills.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {reminders.overdueVendorBills.slice(0, 5).map((bill) => (
                      <Link
                        key={bill.id}
                        href={`/vendor-bills/${bill.id}`}
                        className="flex items-center justify-between py-1.5 hover:bg-muted/50 rounded px-2 -mx-2"
                      >
                        <div>
                          <p className="text-sm font-medium">{bill.billNumber}</p>
                          <p className="text-xs text-muted-foreground">{bill.vendor.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-red-600">{formatCurrency(Number(bill.balanceDue))}</p>
                          <p className="text-xs text-muted-foreground">Due {formatDate(bill.dueDate)}</p>
                        </div>
                      </Link>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Unfiled GST vendor bills */}
              {reminders.unfiledGstBills > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-orange-600 flex items-center gap-1.5">
                      <Shield className="h-4 w-4" />
                      GST Not Filed
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">
                      <span className="font-bold text-lg">{reminders.unfiledGstBills}</span>{" "}
                      vendor bills pending GST filing check.
                    </p>
                    <Link href="/reports" className="text-sm text-primary hover:underline mt-1 inline-block">
                      View Vendor GST Register
                    </Link>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}
