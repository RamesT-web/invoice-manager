import { z } from "zod";
import { router, protectedProcedure } from "../trpc";

export const companyRouter = router({
  /** Get all companies the current user belongs to */
  list: protectedProcedure.query(async ({ ctx }) => {
    const companyUsers = await ctx.db.companyUser.findMany({
      where: { userId: ctx.userId },
      include: { company: true },
      orderBy: { company: { name: "asc" } },
    });
    return companyUsers.map((cu) => ({
      ...cu.company,
      role: cu.role,
      isDefault: cu.isDefault,
    }));
  }),

  /** Get a single company by ID (must be a member) */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const companyUser = await ctx.db.companyUser.findUnique({
        where: {
          companyId_userId: {
            companyId: input.id,
            userId: ctx.userId,
          },
        },
        include: { company: true },
      });
      if (!companyUser) {
        throw new Error("Company not found or access denied");
      }
      return { ...companyUser.company, role: companyUser.role };
    }),

  /** Update company details */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        legalName: z.string().optional(),
        gstin: z.string().optional(),
        pan: z.string().optional(),
        addressLine1: z.string().optional(),
        addressLine2: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        stateName: z.string().optional(),
        pincode: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().email().optional(),
        website: z.string().optional(),
        logoUrl: z.string().optional(),
        bankName: z.string().optional(),
        bankAccountNo: z.string().optional(),
        bankIfsc: z.string().optional(),
        bankBranch: z.string().optional(),
        bankUpiId: z.string().optional(),
        invoicePrefix: z.string().optional(),
        quotePrefix: z.string().optional(),
        defaultTerms: z.string().optional(),
        defaultPaymentTermsDays: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify admin access
      const companyUser = await ctx.db.companyUser.findUnique({
        where: {
          companyId_userId: {
            companyId: input.id,
            userId: ctx.userId,
          },
        },
      });
      if (!companyUser || companyUser.role !== "admin") {
        throw new Error("Admin access required");
      }

      const { id, ...data } = input;
      return ctx.db.company.update({
        where: { id },
        data,
      });
    }),

  /** Set default company for user */
  setDefault: protectedProcedure
    .input(z.object({ companyId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Unset all defaults for this user
      await ctx.db.companyUser.updateMany({
        where: { userId: ctx.userId },
        data: { isDefault: false },
      });
      // Set the selected one as default
      await ctx.db.companyUser.update({
        where: {
          companyId_userId: {
            companyId: input.companyId,
            userId: ctx.userId,
          },
        },
        data: { isDefault: true },
      });
      return { success: true };
    }),
});
