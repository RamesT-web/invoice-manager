import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const dashboardRouter = router({
  /** Get dashboard summary for a company */
  summary: protectedProcedure
    .input(z.object({ companyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { companyId } = input;

      // Verify access
      const companyUser = await ctx.db.companyUser.findUnique({
        where: {
          companyId_userId: { companyId, userId: ctx.userId },
        },
      });
      if (!companyUser) throw new Error("Access denied");

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Run all queries in parallel
      const [
        totalReceivable,
        overdueInvoices,
        paidThisMonth,
        recentInvoices,
        totalInvoices,
      ] = await Promise.all([
        // Total receivable (balance due on non-cancelled invoices)
        ctx.db.invoice.aggregate({
          where: {
            companyId,
            deletedAt: null,
            status: { notIn: ["cancelled", "draft"] },
          },
          _sum: { balanceDue: true },
        }),

        // Overdue invoices
        ctx.db.invoice.findMany({
          where: {
            companyId,
            deletedAt: null,
            status: "overdue",
          },
          select: {
            id: true,
            invoiceNumber: true,
            balanceDue: true,
            dueDate: true,
            customer: { select: { name: true } },
          },
          orderBy: { dueDate: "asc" },
          take: 10,
        }),

        // Paid this month
        ctx.db.payment.aggregate({
          where: {
            companyId,
            type: "received",
            deletedAt: null,
            paymentDate: { gte: startOfMonth },
          },
          _sum: { amount: true },
        }),

        // Recent invoices
        ctx.db.invoice.findMany({
          where: { companyId, deletedAt: null },
          select: {
            id: true,
            invoiceNumber: true,
            invoiceDate: true,
            totalAmount: true,
            balanceDue: true,
            status: true,
            customer: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),

        // Total invoice count
        ctx.db.invoice.count({
          where: { companyId, deletedAt: null },
        }),
      ]);

      return {
        totalReceivable: totalReceivable._sum.balanceDue?.toNumber() ?? 0,
        overdueCount: overdueInvoices.length,
        overdueAmount: overdueInvoices.reduce(
          (sum, inv) => sum + (inv.balanceDue?.toNumber() ?? 0),
          0
        ),
        paidThisMonth: paidThisMonth._sum.amount?.toNumber() ?? 0,
        totalInvoices,
        overdueInvoices,
        recentInvoices,
      };
    }),

  /** Reminders dashboard — overdue invoices, pending TDS certs, follow-ups */
  reminders: protectedProcedure
    .input(z.object({ companyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { companyId } = input;
      const now = new Date();

      const [
        overdueInvoices,
        pendingTdsCerts,
        upcomingFollowUps,
        unmatchedBankTxns,
        overdueVendorBills,
        unfiledGstBills,
      ] = await Promise.all([
        // Overdue: sent/partially_paid with dueDate in the past
        ctx.db.invoice.findMany({
          where: {
            companyId,
            deletedAt: null,
            status: { in: ["sent", "partially_paid"] },
            dueDate: { lt: now },
            balanceDue: { gt: 0 },
          },
          select: {
            id: true,
            invoiceNumber: true,
            dueDate: true,
            balanceDue: true,
            totalAmount: true,
            customer: { select: { name: true } },
          },
          orderBy: { dueDate: "asc" },
          take: 20,
        }),

        // TDS certificates pending
        ctx.db.invoice.findMany({
          where: {
            companyId,
            deletedAt: null,
            tdsApplicable: true,
            tdsCertificateStatus: { in: ["pending", "requested"] },
          },
          select: {
            id: true,
            invoiceNumber: true,
            tdsAmount: true,
            tdsCertificateStatus: true,
            customer: { select: { name: true } },
          },
          orderBy: { invoiceDate: "desc" },
          take: 20,
        }),

        // Upcoming follow-ups (next 7 days)
        ctx.db.invoice.findMany({
          where: {
            companyId,
            deletedAt: null,
            nextFollowUpDate: {
              lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
              gte: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
            },
            status: { notIn: ["paid", "cancelled"] },
          },
          select: {
            id: true,
            invoiceNumber: true,
            nextFollowUpDate: true,
            followUpNotes: true,
            balanceDue: true,
            customer: { select: { name: true } },
          },
          orderBy: { nextFollowUpDate: "asc" },
          take: 20,
        }),

        // Unmatched bank transactions count
        ctx.db.bankTransaction.count({
          where: { companyId, status: "unmatched", credit: { gt: 0 } },
        }),

        // Overdue vendor bills
        ctx.db.vendorBill.findMany({
          where: {
            companyId,
            deletedAt: null,
            status: { in: ["pending", "partially_paid"] },
            dueDate: { lt: now },
            balanceDue: { gt: 0 },
          },
          select: {
            id: true,
            billNumber: true,
            dueDate: true,
            balanceDue: true,
            vendor: { select: { name: true } },
          },
          orderBy: { dueDate: "asc" },
          take: 10,
        }),

        // Vendor bills where GST not yet filed
        ctx.db.vendorBill.count({
          where: {
            companyId,
            deletedAt: null,
            status: { notIn: ["cancelled"] },
            gstFiled: false,
          },
        }),
      ]);

      return {
        overdueInvoices,
        pendingTdsCerts,
        upcomingFollowUps,
        unmatchedBankTxns,
        overdueVendorBills,
        unfiledGstBills,
      };
    }),
});
