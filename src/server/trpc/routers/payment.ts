import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const paymentRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        companyId: z.string().uuid(),
        invoiceId: z.string().uuid().optional(),
        customerId: z.string().uuid().optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        companyId: input.companyId,
        deletedAt: null,
      };
      if (input.invoiceId) where.invoiceId = input.invoiceId;
      if (input.customerId) where.customerId = input.customerId;
      if (input.search) {
        where.OR = [
          { referenceNumber: { contains: input.search, mode: "insensitive" } },
          { notes: { contains: input.search, mode: "insensitive" } },
          { customer: { name: { contains: input.search, mode: "insensitive" } } },
          { invoice: { invoiceNumber: { contains: input.search, mode: "insensitive" } } },
        ];
      }

      return ctx.db.payment.findMany({
        where: where as never,
        include: {
          invoice: { select: { id: true, invoiceNumber: true, totalAmount: true, balanceDue: true } },
          customer: { select: { id: true, name: true } },
        },
        orderBy: { paymentDate: "desc" },
        take: 200,
      });
    }),

  /** Record a payment against an invoice — updates invoice amountPaid/balanceDue/status */
  record: protectedProcedure
    .input(
      z.object({
        companyId: z.string().uuid(),
        invoiceId: z.string().uuid(),
        paymentDate: z.string(),
        amount: z.number().positive(),
        paymentMode: z.string(),
        referenceNumber: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findUniqueOrThrow({
        where: { id: input.invoiceId, deletedAt: null },
        select: { customerId: true, totalAmount: true, amountPaid: true, balanceDue: true },
      });

      const newPaid = Number(invoice.amountPaid) + input.amount;
      const newBalance = Number(invoice.totalAmount) - newPaid;
      const newStatus =
        newBalance <= 0 ? "paid" : newPaid > 0 ? "partially_paid" : undefined;

      // Create payment and update invoice in a transaction
      const [payment] = await ctx.db.$transaction([
        ctx.db.payment.create({
          data: {
            companyId: input.companyId,
            type: "received",
            invoiceId: input.invoiceId,
            customerId: invoice.customerId,
            paymentDate: new Date(input.paymentDate),
            amount: input.amount,
            paymentMode: input.paymentMode,
            referenceNumber: input.referenceNumber,
            notes: input.notes,
            createdBy: ctx.userId,
          },
        }),
        ctx.db.invoice.update({
          where: { id: input.invoiceId },
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

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const payment = await ctx.db.payment.findUniqueOrThrow({
        where: { id: input.id },
        select: { invoiceId: true, amount: true },
      });

      // Reverse the payment on the invoice
      if (payment.invoiceId) {
        const invoice = await ctx.db.invoice.findUniqueOrThrow({
          where: { id: payment.invoiceId },
          select: { amountPaid: true, totalAmount: true, status: true },
        });

        const newPaid = Math.max(0, Number(invoice.amountPaid) - Number(payment.amount));
        const newBalance = Number(invoice.totalAmount) - newPaid;
        const newStatus =
          newPaid <= 0
            ? invoice.status === "paid" || invoice.status === "partially_paid"
              ? "sent"
              : invoice.status
            : newBalance <= 0
              ? "paid"
              : "partially_paid";

        await ctx.db.$transaction([
          ctx.db.payment.update({
            where: { id: input.id },
            data: { deletedAt: new Date() },
          }),
          ctx.db.invoice.update({
            where: { id: payment.invoiceId },
            data: {
              amountPaid: newPaid,
              balanceDue: Math.max(0, newBalance),
              status: newStatus,
              updatedBy: ctx.userId,
            },
          }),
        ]);
      } else {
        await ctx.db.payment.update({
          where: { id: input.id },
          data: { deletedAt: new Date() },
        });
      }

      return { success: true };
    }),
});
