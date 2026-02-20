import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const vendorRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        companyId: z.string().uuid(),
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
      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { gstin: { contains: input.search, mode: "insensitive" } },
          { contactEmail: { contains: input.search, mode: "insensitive" } },
        ];
      }
      return ctx.db.vendor.findMany({
        where: where as never,
        orderBy: { name: "asc" },
        take: 200,
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.vendor.findUniqueOrThrow({
        where: { id: input.id, deletedAt: null },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        companyId: z.string().uuid(),
        name: z.string().min(1),
        gstin: z.string().optional().nullable(),
        pan: z.string().optional().nullable(),
        addressLine1: z.string().optional().nullable(),
        addressLine2: z.string().optional().nullable(),
        city: z.string().optional().nullable(),
        state: z.string().optional().nullable(),
        stateName: z.string().optional().nullable(),
        pincode: z.string().optional().nullable(),
        contactName: z.string().optional().nullable(),
        contactEmail: z.string().optional().nullable(),
        contactPhone: z.string().optional().nullable(),
        paymentTermsDays: z.number().optional().nullable(),
        openingBalance: z.number().optional(),
        notes: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.vendor.create({
        data: { ...input, createdBy: ctx.userId, updatedBy: ctx.userId },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        gstin: z.string().optional().nullable(),
        pan: z.string().optional().nullable(),
        addressLine1: z.string().optional().nullable(),
        addressLine2: z.string().optional().nullable(),
        city: z.string().optional().nullable(),
        state: z.string().optional().nullable(),
        stateName: z.string().optional().nullable(),
        pincode: z.string().optional().nullable(),
        contactName: z.string().optional().nullable(),
        contactEmail: z.string().optional().nullable(),
        contactPhone: z.string().optional().nullable(),
        paymentTermsDays: z.number().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.vendor.update({
        where: { id },
        data: { ...data, updatedBy: ctx.userId },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.vendor.update({
        where: { id: input.id },
        data: { deletedAt: new Date(), isActive: false },
      });
    }),

  restore: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.vendor.update({
        where: { id: input.id },
        data: { deletedAt: null, isActive: true, updatedBy: ctx.userId },
      });
    }),
});
