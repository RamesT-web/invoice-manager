import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { executeRentalRun } from "@/server/services/rental-invoicing";

export const rentalRouter = router({
  generateInvoices: protectedProcedure
    .input(
      z.object({
        companyId: z.string(),
        month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM format"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return executeRentalRun(
        ctx.db,
        input.companyId,
        input.month,
        ctx.session.user!.id as string
      );
    }),

  listRuns: protectedProcedure
    .input(
      z.object({
        companyId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.invoiceRun.findMany({
        where: { companyId: input.companyId },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    }),

  getRun: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const run = await ctx.db.invoiceRun.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          invoices: {
            include: {
              customer: { select: { id: true, name: true } },
            },
            orderBy: { invoiceNumber: "asc" },
          },
        },
      });
      return run;
    }),
});
