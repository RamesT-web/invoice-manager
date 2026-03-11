"use client";

import { trpc } from "@/lib/trpc";
import { useCompanyStore } from "@/lib/hooks/use-company";
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
  ArrowRight,
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
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-lg border p-5">
              <div className="h-16 animate-pulse bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Receivable"
          value={formatCurrency(data?.totalReceivable ?? 0)}
          icon={IndianRupee}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <SummaryCard
          label="Overdue"
          value={formatCurrency(data?.overdueAmount ?? 0)}
          subtitle={`${data?.overdueCount ?? 0} invoices`}
          icon={AlertTriangle}
          iconBg="bg-red-50"
          iconColor="text-red-500"
          valueColor="text-red-600"
        />
        <SummaryCard
          label="Paid This Month"
          value={formatCurrency(data?.paidThisMonth ?? 0)}
          icon={TrendingUp}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          valueColor="text-emerald-600"
        />
        <SummaryCard
          label="Total Invoices"
          value={String(data?.totalInvoices ?? 0)}
          icon={FileText}
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
        />
      </div>

      {/* Recent Invoices */}
      <div className="bg-white rounded-lg border">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Recent Invoices</h2>
          <Link
            href="/invoices"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div>
          {data?.recentInvoices && data.recentInvoices.length > 0 ? (
            <div>
              {data.recentInvoices.map((invoice, idx) => {
                const statusConfig = INVOICE_STATUSES.find(
                  (s) => s.value === invoice.status
                );
                return (
                  <Link
                    key={invoice.id}
                    href={`/invoices/${invoice.id}`}
                    className={`flex items-center justify-between px-5 py-3 hover:bg-blue-50/40 transition-colors ${
                      idx < data.recentInvoices.length - 1 ? "border-b border-gray-50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {invoice.invoiceNumber}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {invoice.customer.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">
                          {formatCurrency(
                            typeof invoice.totalAmount === "object"
                              ? (invoice.totalAmount as { toNumber: () => number }).toNumber()
                              : Number(invoice.totalAmount)
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDate(invoice.invoiceDate)}
                        </p>
                      </div>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${statusConfig?.color ?? "bg-gray-100 text-gray-700"}`}>
                        {statusConfig?.label ?? invoice.status}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10">
              <FileText className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500">No invoices yet.</p>
              <Link
                href="/invoices/new"
                className="text-blue-600 hover:text-blue-700 text-sm font-medium mt-2 inline-block"
              >
                Create your first invoice
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Reminders Section */}
      {reminders && (
        (reminders.overdueInvoices.length > 0 ||
         reminders.pendingTdsCerts.length > 0 ||
         reminders.upcomingFollowUps.length > 0 ||
         reminders.unmatchedBankTxns > 0 ||
         reminders.overdueVendorBills.length > 0 ||
         reminders.unfiledGstBills > 0) && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              Reminders & Alerts
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Overdue Invoices */}
              {reminders.overdueInvoices.length > 0 && (
                <ReminderCard
                  title={`Overdue (${reminders.overdueInvoices.length})`}
                  titleColor="text-red-600"
                  icon={AlertTriangle}
                >
                  {reminders.overdueInvoices.slice(0, 5).map((inv) => (
                    <ReminderRow
                      key={inv.id}
                      href={`/invoices/${inv.id}`}
                      primary={inv.invoiceNumber}
                      secondary={inv.customer.name}
                      value={formatCurrency(Number(inv.balanceDue))}
                      valueColor="text-red-600"
                      detail={`Due ${formatDate(inv.dueDate)}`}
                    />
                  ))}
                </ReminderCard>
              )}

              {/* Pending TDS Certificates */}
              {reminders.pendingTdsCerts.length > 0 && (
                <ReminderCard
                  title={`Pending TDS Certificates (${reminders.pendingTdsCerts.length})`}
                  titleColor="text-orange-600"
                  icon={Shield}
                >
                  {reminders.pendingTdsCerts.slice(0, 5).map((inv) => (
                    <ReminderRow
                      key={inv.id}
                      href={`/invoices/${inv.id}`}
                      primary={inv.invoiceNumber}
                      secondary={inv.customer.name}
                      value={formatCurrency(Number(inv.tdsAmount))}
                      detail={inv.tdsCertificateStatus}
                    />
                  ))}
                </ReminderCard>
              )}

              {/* Upcoming Follow-ups */}
              {reminders.upcomingFollowUps.length > 0 && (
                <ReminderCard
                  title={`Upcoming Follow-ups (${reminders.upcomingFollowUps.length})`}
                  titleColor="text-blue-600"
                  icon={CalendarClock}
                >
                  {reminders.upcomingFollowUps.slice(0, 5).map((inv) => (
                    <ReminderRow
                      key={inv.id}
                      href={`/invoices/${inv.id}`}
                      primary={inv.invoiceNumber}
                      secondary={inv.customer.name}
                      value={formatCurrency(Number(inv.balanceDue))}
                      detail={formatDate(inv.nextFollowUpDate!)}
                    />
                  ))}
                </ReminderCard>
              )}

              {/* Unmatched Bank Transactions */}
              {reminders.unmatchedBankTxns > 0 && (
                <div className="bg-white rounded-lg border p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Landmark className="h-4 w-4 text-violet-600" />
                    <h3 className="text-sm font-semibold text-violet-600">Bank Reconciliation</h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    <span className="text-2xl font-bold text-gray-900">{reminders.unmatchedBankTxns}</span>{" "}
                    unmatched bank credits need review.
                  </p>
                  <Link href="/banking/reconcile" className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-2 inline-flex items-center gap-1">
                    Go to Reconciliation
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}

              {/* Overdue Vendor Bills */}
              {reminders.overdueVendorBills.length > 0 && (
                <ReminderCard
                  title={`Overdue Vendor Bills (${reminders.overdueVendorBills.length})`}
                  titleColor="text-red-600"
                  icon={ShoppingCart}
                >
                  {reminders.overdueVendorBills.slice(0, 5).map((bill) => (
                    <ReminderRow
                      key={bill.id}
                      href={`/vendor-bills/${bill.id}`}
                      primary={bill.billNumber}
                      secondary={bill.vendor.name}
                      value={formatCurrency(Number(bill.balanceDue))}
                      valueColor="text-red-600"
                      detail={`Due ${formatDate(bill.dueDate)}`}
                    />
                  ))}
                </ReminderCard>
              )}

              {/* Unfiled GST vendor bills */}
              {reminders.unfiledGstBills > 0 && (
                <div className="bg-white rounded-lg border p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="h-4 w-4 text-orange-600" />
                    <h3 className="text-sm font-semibold text-orange-600">GST Not Filed</h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    <span className="text-2xl font-bold text-gray-900">{reminders.unfiledGstBills}</span>{" "}
                    vendor bills pending GST filing check.
                  </p>
                  <Link href="/reports" className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-2 inline-flex items-center gap-1">
                    View Vendor GST Register
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}

/* ---- Helper components ---- */

function SummaryCard({
  label,
  value,
  subtitle,
  icon: Icon,
  iconBg,
  iconColor,
  valueColor,
}: {
  label: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-white rounded-lg border p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          <p className={`text-2xl font-bold mt-1.5 ${valueColor ?? "text-gray-900"}`}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
          )}
        </div>
        <div className={`h-10 w-10 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}

function ReminderCard({
  title,
  titleColor,
  icon: Icon,
  children,
}: {
  title: string;
  titleColor: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg border">
      <div className="flex items-center gap-2 px-5 py-3 border-b">
        <Icon className={`h-4 w-4 ${titleColor}`} />
        <h3 className={`text-sm font-semibold ${titleColor}`}>{title}</h3>
      </div>
      <div className="divide-y divide-gray-50">
        {children}
      </div>
    </div>
  );
}

function ReminderRow({
  href,
  primary,
  secondary,
  value,
  valueColor,
  detail,
}: {
  href: string;
  primary: string;
  secondary: string;
  value: string;
  valueColor?: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between px-5 py-2.5 hover:bg-blue-50/40 transition-colors"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{primary}</p>
        <p className="text-xs text-gray-500 truncate">{secondary}</p>
      </div>
      <div className="text-right shrink-0 ml-4">
        <p className={`text-sm font-semibold ${valueColor ?? "text-gray-900"}`}>{value}</p>
        <p className="text-xs text-gray-500 capitalize">{detail}</p>
      </div>
    </Link>
  );
}
