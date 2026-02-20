import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

const itemInput = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  hsnSacCode: z.string().optional().nullable(),
  type: z.enum(["goods", "service"]).default("service"),
  unit: z.string().default("nos"),
  defaultRate: z.number().min(0).default(0),
  gstRate: z.number().min(0).max(28).default(18),
});

export const itemRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        companyId: z.string().uuid(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        companyId: input.companyId,
        deletedAt: null,
        isActive: true,
      };
      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { hsnSacCode: { contains: input.search, mode: "insensitive" } },
        ];
      }
      return ctx.db.item.findMany({
        where: where as never,
        orderBy: { name: "asc" },
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.item.findUniqueOrThrow({
        where: { id: input.id, deletedAt: null },
      });
    }),

  create: protectedProcedure
    .input(itemInput.extend({ companyId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { companyId, ...data } = input;
      return ctx.db.item.create({
        data: {
          ...data,
          companyId,
          createdBy: ctx.userId,
        },
      });
    }),

  update: protectedProcedure
    .input(itemInput.extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.item.update({
        where: { id },
        data,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.item.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      });
    }),
});
