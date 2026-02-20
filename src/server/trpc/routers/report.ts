import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const reportRouter = router({
  /** Outstanding aging report — customer-wise */
  outstandingAging: protectedProcedure
    .input(z.object({ companyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const invoices = await ctx.db.invoice.findMany({
        where: {
          companyId: input.companyId,
          deletedAt: null,
          status: { in: ["sent", "partially_paid", "overdue"] },
          balanceDue: { gt: 0 },
        },
        select: {
          id: true,
          invoiceNumber: true,
          invoiceDate: true,
          dueDate: true,
          totalAmount: true,
          balanceDue: true,
          status: true,
          customer: { select: { id: true, name: true } },
        },
        orderBy: { dueDate: "asc" },
      });

      const now = new Date();
      return invoices.map((inv) => {
        const daysOverdue = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
        let bucket: string;
        if (daysOverdue <= 0) bucket = "Current";
        else if (daysOverdue <= 30) bucket = "1-30 days";
        else if (daysOverdue <= 60) bucket = "31-60 days";
        else if (daysOverdue <= 90) bucket = "61-90 days";
        else bucket = "90+ days";

        return {
          invoiceNumber: inv.invoiceNumber,
          customerName: inv.customer.name,
          invoiceDate: inv.invoiceDate,
          dueDate: inv.dueDate,
          totalAmount: Number(inv.totalAmount),
          balanceDue: Number(inv.balanceDue),
          daysOverdue: Math.max(0, daysOverdue),
          bucket,
        };
      });
    }),

  /** TDS register — invoice-wise */
  tdsRegister: protectedProcedure
    .input(z.object({ companyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const invoices = await ctx.db.invoice.findMany({
        where: {
          companyId: input.companyId,
          deletedAt: null,
          tdsApplicable: true,
        },
        select: {
          id: true,
          invoiceNumber: true,
          invoiceDate: true,
          totalAmount: true,
          tdsRate: true,
          tdsAmount: true,
          tdsCertificateStatus: true,
          tdsCertificateReceivedDate: true,
          customer: { select: { name: true, pan: true } },
        },
        orderBy: { invoiceDate: "desc" },
      });

      return invoices.map((inv) => ({
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        customerName: inv.customer.name,
        customerPan: inv.customer.pan,
        totalAmount: Number(inv.totalAmount),
        tdsRate: Number(inv.tdsRate ?? 0),
        tdsAmount: Number(inv.tdsAmount),
        certificateStatus: inv.tdsCertificateStatus,
        certificateReceivedDate: inv.tdsCertificateReceivedDate,
      }));
    }),

  /** Sales summary — month-wise */
  salesSummary: protectedProcedure
    .input(z.object({ companyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const invoices = await ctx.db.invoice.findMany({
        where: {
          companyId: input.companyId,
          deletedAt: null,
          status: { notIn: ["draft", "cancelled"] },
        },
        select: {
          invoiceDate: true,
          taxableAmount: true,
          cgstAmount: true,
          sgstAmount: true,
          igstAmount: true,
          totalAmount: true,
          amountPaid: true,
        },
        orderBy: { invoiceDate: "asc" },
      });

      // Group by month
      const monthMap = new Map<string, {
        month: string;
        invoiceCount: number;
        taxableAmount: number;
        cgst: number;
        sgst: number;
        igst: number;
        totalAmount: number;
        collected: number;
      }>();

      for (const inv of invoices) {
        const d = new Date(inv.invoiceDate);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const entry = monthMap.get(key) ?? {
          month: key,
          invoiceCount: 0,
          taxableAmount: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          totalAmount: 0,
          collected: 0,
        };
        entry.invoiceCount++;
        entry.taxableAmount += Number(inv.taxableAmount);
        entry.cgst += Number(inv.cgstAmount);
        entry.sgst += Number(inv.sgstAmount);
        entry.igst += Number(inv.igstAmount);
        entry.totalAmount += Number(inv.totalAmount);
        entry.collected += Number(inv.amountPaid);
        monthMap.set(key, entry);
      }

      return Array.from(monthMap.values()).sort((a, b) => b.month.localeCompare(a.month));
    }),

  /** Vendor GST / GSTR-2B register — vendor bill-wise */
  vendorGstRegister: protectedProcedure
    .input(z.object({ companyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const bills = await ctx.db.vendorBill.findMany({
        where: {
          companyId: input.companyId,
          deletedAt: null,
        },
        select: {
          id: true,
          billNumber: true,
          billDate: true,
          totalAmount: true,
          taxableAmount: true,
          cgstAmount: true,
          sgstAmount: true,
          igstAmount: true,
          gstFiled: true,
          gstr2bReflected: true,
          itcEligible: true,
          portalCheckDate: true,
          complianceNotes: true,
          tdsApplicable: true,
          tdsAmount: true,
          vendor: { select: { name: true, gstin: true } },
        },
        orderBy: { billDate: "desc" },
      });

      return bills.map((b) => ({
        billNumber: b.billNumber,
        billDate: b.billDate,
        vendorName: b.vendor.name,
        vendorGstin: b.vendor.gstin,
        taxableAmount: Number(b.taxableAmount),
        cgst: Number(b.cgstAmount),
        sgst: Number(b.sgstAmount),
        igst: Number(b.igstAmount),
        totalAmount: Number(b.totalAmount),
        gstFiled: b.gstFiled,
        gstr2bReflected: b.gstr2bReflected,
        itcEligible: b.itcEligible,
        portalCheckDate: b.portalCheckDate,
        tdsApplicable: b.tdsApplicable,
        tdsAmount: Number(b.tdsAmount),
      }));
    }),

  /** Data backup — all core data as JSON for CSV export */
  dataBackup: protectedProcedure
    .input(z.object({ companyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [customers, vendors, invoices, vendorBills, payments] = await Promise.all([
        ctx.db.customer.findMany({
          where: { companyId: input.companyId, deletedAt: null },
          orderBy: { name: "asc" },
        }),
        ctx.db.vendor.findMany({
          where: { companyId: input.companyId, deletedAt: null },
          orderBy: { name: "asc" },
        }),
        ctx.db.invoice.findMany({
          where: { companyId: input.companyId, deletedAt: null },
          include: {
            customer: { select: { name: true } },
            lines: { orderBy: { sortOrder: "asc" } },
          },
          orderBy: { invoiceDate: "desc" },
        }),
        ctx.db.vendorBill.findMany({
          where: { companyId: input.companyId, deletedAt: null },
          include: {
            vendor: { select: { name: true } },
            lines: { orderBy: { sortOrder: "asc" } },
          },
          orderBy: { billDate: "desc" },
        }),
        ctx.db.payment.findMany({
          where: { companyId: input.companyId, deletedAt: null },
          include: {
            invoice: { select: { invoiceNumber: true } },
            customer: { select: { name: true } },
            vendor: { select: { name: true } },
            vendorBill: { select: { billNumber: true } },
          },
          orderBy: { paymentDate: "desc" },
        }),
      ]);

      return { customers, vendors, invoices, vendorBills, payments };
    }),
});
