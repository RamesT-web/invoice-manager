import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { calcLineItem, calcInvoiceTotals, isInterState } from "@/server/services/gst";
import { generateInvoiceNumber } from "@/server/services/invoice-number";

/** Compute invoice status from balance + due date (skips draft/cancelled) */
function computeInvoiceStatus(invoice: { status: string; balanceDue: number | { toNumber(): number }; dueDate: Date | string }): string {
  const { status } = invoice;
  if (status === "draft" || status === "cancelled") return status;
  const balance = typeof invoice.balanceDue === "number" ? invoice.balanceDue : invoice.balanceDue.toNumber();
  if (balance <= 0) return "paid";
  const due = new Date(invoice.dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  if (due < now) return "overdue";
  if (status === "partially_paid") return "partially_paid";
  return status;
}

const lineItemSchema = z.object({
  itemId: z.string().uuid().optional().nullable(),
  description: z.string().min(1),
  hsnSacCode: z.string().optional().nullable(),
  quantity: z.number().min(0),
  unit: z.string().default("nos"),
  rate: z.number().min(0),
  gstRate: z.number().min(0).max(28),
  discountType: z.enum(["percentage", "fixed"]).optional().nullable(),
  discountValue: z.number().optional().nullable(),
  sortOrder: z.number().default(0),
});

export const invoiceRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        companyId: z.string().uuid(),
        status: z.string().optional(),
        customerId: z.string().uuid().optional(),
        search: z.string().optional(),
        showDeleted: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        companyId: input.companyId,
      };
      if (input.showDeleted) {
        where.deletedAt = { not: null };
      } else {
        where.deletedAt = null;
      }
      if (input.status) where.status = input.status;
      if (input.customerId) where.customerId = input.customerId;
      if (input.search) {
        where.OR = [
          { invoiceNumber: { contains: input.search, mode: "insensitive" } },
          { customer: { name: { contains: input.search, mode: "insensitive" } } },
        ];
      }

      const invoices = await ctx.db.invoice.findMany({
        where: where as never,
        include: {
          customer: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      // Auto-compute status for non-deleted invoices
      if (!input.showDeleted) {
        const updates: Promise<unknown>[] = [];
        for (const inv of invoices) {
          const computed = computeInvoiceStatus(inv);
          if (computed !== inv.status) {
            inv.status = computed;
            updates.push(
              ctx.db.invoice.update({
                where: { id: inv.id },
                data: { status: computed },
              })
            );
          }
        }
        if (updates.length > 0) await Promise.all(updates);
      }

      return invoices;
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.invoice.findUniqueOrThrow({
        where: { id: input.id, deletedAt: null },
        include: {
          customer: true,
          lines: { orderBy: { sortOrder: "asc" } },
          payments: {
            where: { deletedAt: null },
            orderBy: { paymentDate: "desc" },
          },
        },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        companyId: z.string().uuid(),
        customerId: z.string().uuid(),
        invoiceDate: z.string(),
        dueDate: z.string(),
        placeOfSupply: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        terms: z.string().optional().nullable(),
        status: z.enum(["draft", "sent"]).default("draft"),
        lines: z.array(lineItemSchema).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { companyId, lines: lineInputs, ...invoiceData } = input;

      // Get company state for GST calculation
      const company = await ctx.db.company.findUniqueOrThrow({
        where: { id: companyId },
        select: {
          state: true,
          bankName: true,
          bankAccountNo: true,
          bankIfsc: true,
          bankBranch: true,
          bankUpiId: true,
          defaultTerms: true,
        },
      });

      const interState = isInterState(company.state, input.placeOfSupply);

      // Calculate each line
      const calculatedLines = lineInputs.map((line, idx) => {
        const calc = calcLineItem(
          {
            quantity: line.quantity,
            rate: line.rate,
            gstRate: line.gstRate,
            discountType: line.discountType,
            discountValue: line.discountValue,
          },
          interState
        );
        return {
          ...line,
          sortOrder: idx,
          taxableAmount: calc.taxableAmount,
          cgstAmount: calc.cgstAmount,
          sgstAmount: calc.sgstAmount,
          igstAmount: calc.igstAmount,
          lineTotal: calc.lineTotal,
          discountAmount: calc.discountAmount,
        };
      });

      // Calculate invoice totals
      const totals = calcInvoiceTotals(
        calculatedLines.map((l) => ({
          amount: l.quantity * l.rate,
          discountAmount: l.discountAmount,
          taxableAmount: l.taxableAmount,
          cgstAmount: l.cgstAmount,
          sgstAmount: l.sgstAmount,
          igstAmount: l.igstAmount,
          lineTotal: l.lineTotal,
        }))
      );

      // Generate invoice number
      const invoiceNumber = await generateInvoiceNumber(ctx.db, companyId);

      // Create invoice + lines in a transaction
      const invoice = await ctx.db.invoice.create({
        data: {
          companyId,
          invoiceNumber,
          customerId: invoiceData.customerId,
          invoiceDate: new Date(invoiceData.invoiceDate),
          dueDate: new Date(invoiceData.dueDate),
          placeOfSupply: invoiceData.placeOfSupply,
          status: invoiceData.status,
          notes: invoiceData.notes ?? company.defaultTerms,
          terms: invoiceData.terms,
          bankName: company.bankName,
          bankAccountNo: company.bankAccountNo,
          bankIfsc: company.bankIfsc,
          bankBranch: company.bankBranch,
          bankUpiId: company.bankUpiId,
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          taxableAmount: totals.taxableAmount,
          cgstAmount: totals.cgstAmount,
          sgstAmount: totals.sgstAmount,
          igstAmount: totals.igstAmount,
          totalAmount: totals.totalAmount,
          balanceDue: totals.totalAmount,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
          lines: {
            create: calculatedLines.map((line) => ({
              itemId: line.itemId,
              sortOrder: line.sortOrder,
              description: line.description,
              hsnSacCode: line.hsnSacCode,
              quantity: line.quantity,
              unit: line.unit,
              rate: line.rate,
              gstRate: line.gstRate,
              discountType: line.discountType,
              discountValue: line.discountValue,
              discountAmount: line.discountAmount,
              taxableAmount: line.taxableAmount,
              cgstAmount: line.cgstAmount,
              sgstAmount: line.sgstAmount,
              igstAmount: line.igstAmount,
              lineTotal: line.lineTotal,
            })),
          },
        },
        include: {
          customer: true,
          lines: true,
        },
      });

      return invoice;
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.invoice.update({
        where: { id: input.id },
        data: { status: input.status, updatedBy: ctx.userId },
      });
    }),

  /** Update TDS + follow-up compliance fields */
  updateCompliance: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        tdsApplicable: z.boolean().optional(),
        tdsRate: z.number().min(0).max(100).optional().nullable(),
        tdsAmount: z.number().min(0).optional(),
        tdsCertificateStatus: z.string().optional(),
        tdsCertificateReceivedDate: z.string().optional().nullable(),
        nextFollowUpDate: z.string().optional().nullable(),
        followUpNotes: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, tdsCertificateReceivedDate, nextFollowUpDate, ...rest } = input;
      return ctx.db.invoice.update({
        where: { id },
        data: {
          ...rest,
          ...(tdsCertificateReceivedDate !== undefined
            ? { tdsCertificateReceivedDate: tdsCertificateReceivedDate ? new Date(tdsCertificateReceivedDate) : null }
            : {}),
          ...(nextFollowUpDate !== undefined
            ? { nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : null }
            : {}),
          updatedBy: ctx.userId,
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.invoice.update({
        where: { id: input.id },
        data: { deletedAt: new Date(), updatedBy: ctx.userId },
      });
    }),

  restore: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const inv = await ctx.db.invoice.update({
        where: { id: input.id },
        data: { deletedAt: null, updatedBy: ctx.userId },
      });
      // Recompute status after restore
      const computed = computeInvoiceStatus(inv);
      if (computed !== inv.status) {
        return ctx.db.invoice.update({
          where: { id: inv.id },
          data: { status: computed },
        });
      }
      return inv;
    }),
});
