import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const settingRouter = router({
  /** Get a single setting value by key */
  get: protectedProcedure
    .input(
      z.object({
        companyId: z.string().uuid(),
        key: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const setting = await ctx.db.setting.findUnique({
        where: {
          companyId_key: {
            companyId: input.companyId,
            key: input.key,
          },
        },
      });
      return setting;
    }),

  /** Upsert a setting value */
  set: protectedProcedure
    .input(
      z.object({
        companyId: z.string().uuid(),
        key: z.string(),
        value: z.any(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.setting.upsert({
        where: {
          companyId_key: {
            companyId: input.companyId,
            key: input.key,
          },
        },
        create: {
          companyId: input.companyId,
          key: input.key,
          value: input.value,
          updatedBy: ctx.session.user?.id as string,
        },
        update: {
          value: input.value,
          updatedBy: ctx.session.user?.id as string,
        },
      });
    }),
});
