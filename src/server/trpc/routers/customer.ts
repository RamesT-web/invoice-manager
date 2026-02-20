import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

const customerInput = z.object({
  name: z.string().min(1),
  gstin: z.string().max(15).optional().nullable(),
  pan: z.string().max(10).optional().nullable(),
  billingAddressLine1: z.string().optional().nullable(),
  billingAddressLine2: z.string().optional().nullable(),
  billingCity: z.string().optional().nullable(),
  billingState: z.string().optional().nullable(),
  billingStateName: z.string().optional().nullable(),
  billingPincode: z.string().optional().nullable(),
  shippingAddressLine1: z.string().optional().nullable(),
  shippingAddressLine2: z.string().optional().nullable(),
  shippingCity: z.string().optional().nullable(),
  shippingState: z.string().optional().nullable(),
  shippingStateName: z.string().optional().nullable(),
  shippingPincode: z.string().optional().nullable(),
  contactName: z.string().optional().nullable(),
  contactEmail: z.string().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  contactWhatsapp: z.string().optional().nullable(),
  paymentTermsDays: z.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const customerRouter = router({
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
        where.isActive = true;
      }
      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { gstin: { contains: input.search, mode: "insensitive" } },
          { contactName: { contains: input.search, mode: "insensitive" } },
          { contactEmail: { contains: input.search, mode: "insensitive" } },
        ];
      }
      return ctx.db.customer.findMany({
        where: where as never,
        orderBy: { name: "asc" },
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.customer.findUniqueOrThrow({
        where: { id: input.id, deletedAt: null },
      });
    }),

  create: protectedProcedure
    .input(customerInput.extend({ companyId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { companyId, ...data } = input;
      return ctx.db.customer.create({
        data: {
          ...data,
          companyId,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      });
    }),

  update: protectedProcedure
    .input(customerInput.extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.customer.update({
        where: { id },
        data: { ...data, updatedBy: ctx.userId },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.customer.update({
        where: { id: input.id },
        data: { deletedAt: new Date(), isActive: false },
      });
    }),

  restore: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.customer.update({
        where: { id: input.id },
        data: { deletedAt: null, isActive: true, updatedBy: ctx.userId },
      });
    }),
});
