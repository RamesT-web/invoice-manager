import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { calcLineItem, calcInvoiceTotals, isInterState } from "@/server/services/gst";

/** Compute vendor bill status from balance + due date (skips cancelled) */
function computeVendorBillStatus(bill: { status: string; balanceDue: number | { toNumber(): number }; totalAmount: number | { toNumber(): number }; amountPaid: number | { toNumber(): number }; dueDate: Date | string }): string {
  const { status } = bill;
  if (status === "cancelled") return status;
  const balance = typeof bill.balanceDue === "number" ? bill.balanceDue : bill.balanceDue.toNumber();
  const paid = typeof bill.amountPaid === "number" ? bill.amountPaid : bill.amountPaid.toNumber();
  if (balance <= 0) return "paid";
  if (paid > 0) return "partially_paid";
  const due = new Date(bill.dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  if (due < now) return "overdue";
  return "pending";
}

const lineItemSchema = z.object({
  itemId: z.string().uuid().optional().nullable(),
  description: z.string().min(1),
  hsnSacCode: z.string().optional().nullable(),
  quantity: z.number().min(0),
  unit: z.string().default("nos"),
  rate: z.number().min(0),
  gstRate: z.number().min(0).max(28),
  sortOrder: z.number().default(0),
});

export const vendorBillRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        companyId: z.string().uuid(),
        status: z.string().optional(),
        vendorId: z.string().uuid().optional(),
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
      if (input.vendorId) where.vendorId = input.vendorId;
      if (input.search) {
        where.OR = [
          { billNumber: { contains: input.search, mode: "insensitive" } },
          { vendor: { name: { contains: input.search, mode: "insensitive" } } },
        ];
      }
      const bills = await ctx.db.vendorBill.findMany({
        where: where as never,
        include: {
          vendor: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      // Auto-compute status for non-deleted bills
      if (!input.showDeleted) {
        const updates: Promise<unknown>[] = [];
        for (const bill of bills) {
          const computed = computeVendorBillStatus(bill);
          if (computed !== bill.status) {
            bill.status = computed;
            updates.push(
              ctx.db.vendorBill.update({
                where: { id: bill.id },
                data: { status: computed },
              })
            );
          }
        }
        if (updates.length > 0) await Promise.all(updates);
      }

      return bills;
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.vendorBill.findUniqueOrThrow({
        where: { id: input.id, deletedAt: null },
        include: {
          vendor: true,
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
        vendorId: z.string().uuid(),
        billNumber: z.string().min(1),
        billDate: z.string(),
        dueDate: z.string(),
        placeOfSupply: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        attachmentUrl: z.string().optional().nullable(),
        lines: z.array(lineItemSchema).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { companyId, lines: lineInputs, ...billData } = input;

      const company = await ctx.db.company.findUniqueOrThrow({
        where: { id: companyId },
        select: { state: true },
      });

      const interState = isInterState(company.state, input.placeOfSupply);

      const calculatedLines = lineInputs.map((line, idx) => {
        const calc = calcLineItem(
          { quantity: line.quantity, rate: line.rate, gstRate: line.gstRate, discountType: null, discountValue: null },
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

      return ctx.db.vendorBill.create({
        data: {
          companyId,
          vendorId: billData.vendorId,
          billNumber: billData.billNumber,
          billDate: new Date(billData.billDate),
          dueDate: new Date(billData.dueDate),
          placeOfSupply: billData.placeOfSupply,
          notes: billData.notes,
          attachmentUrl: billData.attachmentUrl,
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
              discountAmount: line.discountAmount,
              taxableAmount: line.taxableAmount,
              cgstAmount: line.cgstAmount,
              sgstAmount: line.sgstAmount,
              igstAmount: line.igstAmount,
              lineTotal: line.lineTotal,
            })),
          },
        },
        include: { vendor: true, lines: true },
      });
    }),

  /** Update compliance fields */
  updateCompliance: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        tdsApplicable: z.boolean().optional(),
        tdsRate: z.number().min(0).max(100).optional().nullable(),
        tdsAmount: z.number().min(0).optional(),
        gstFiled: z.boolean().optional(),
        gstr2bReflected: z.boolean().optional(),
        portalCheckDate: z.string().optional().nullable(),
        itcEligible: z.boolean().optional(),
        complianceNotes: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, portalCheckDate, ...rest } = input;
      return ctx.db.vendorBill.update({
        where: { id },
        data: {
          ...rest,
          ...(portalCheckDate !== undefined
            ? { portalCheckDate: portalCheckDate ? new Date(portalCheckDate) : null }
            : {}),
          updatedBy: ctx.userId,
        },
      });
    }),

  /** Record payment against vendor bill */
  recordPayment: protectedProcedure
    .input(
      z.object({
        companyId: z.string().uuid(),
        vendorBillId: z.string().uuid(),
        paymentDate: z.string(),
        amount: z.number().positive(),
        paymentMode: z.string(),
        referenceNumber: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const bill = await ctx.db.vendorBill.findUniqueOrThrow({
        where: { id: input.vendorBillId, deletedAt: null },
        select: { vendorId: true, totalAmount: true, amountPaid: true },
      });

      const newPaid = Number(bill.amountPaid) + input.amount;
      const newBalance = Number(bill.totalAmount) - newPaid;
      const newStatus = newBalance <= 0 ? "paid" : newPaid > 0 ? "partially_paid" : undefined;

      const [payment] = await ctx.db.$transaction([
        ctx.db.payment.create({
          data: {
            companyId: input.companyId,
            type: "made",
            vendorBillId: input.vendorBillId,
            vendorId: bill.vendorId,
            paymentDate: new Date(input.paymentDate),
            amount: input.amount,
            paymentMode: input.paymentMode,
            referenceNumber: input.referenceNumber,
            notes: input.notes,
            createdBy: ctx.userId,
          },
        }),
        ctx.db.vendorBill.update({
          where: { id: input.vendorBillId },
          data: {
            amountPaid: newPaid,
            balanceDue: Math.max(0, newBalance),
            ...(newStatus ? { status: newStatus } : {}),
            updatedBy: ctx.userId,
          },
        }),
      ]);
      return payment;
    }),

  updateStatus: protectedProcedure
    .input(z.object({ id: z.string().uuid(), status: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.vendorBill.update({
        where: { id: input.id },
        data: { status: input.status, updatedBy: ctx.userId },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.vendorBill.update({
        where: { id: input.id },
        data: { deletedAt: new Date(), updatedBy: ctx.userId },
      });
    }),

  restore: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const bill = await ctx.db.vendorBill.update({
        where: { id: input.id },
        data: { deletedAt: null, updatedBy: ctx.userId },
      });
      const computed = computeVendorBillStatus(bill);
      if (computed !== bill.status) {
        return ctx.db.vendorBill.update({
          where: { id: bill.id },
          data: { status: computed },
        });
      }
      return bill;
    }),
});
