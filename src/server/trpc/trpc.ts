import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";

export const createTRPCContext = async () => {
  const session = await auth();
  return { db, session };
};

type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      userId: ctx.session.user.id as string,
    },
  });
});

/**
 * Procedure that verifies the caller is a member of the requested company.
 * Input MUST include `companyId: z.string().uuid()`.
 * Adds `companyId` and `companyRole` to context.
 */
export const companyMemberProcedure = protectedProcedure
  .input(z.object({ companyId: z.string().uuid() }))
  .use(async ({ ctx, input, next }) => {
    const membership = await ctx.db.companyUser.findUnique({
      where: {
        companyId_userId: {
          companyId: input.companyId,
          userId: ctx.userId,
        },
      },
    });
    if (!membership) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have access to this company",
      });
    }
    return next({
      ctx: {
        ...ctx,
        companyId: input.companyId,
        companyRole: membership.role,
      },
    });
  });

/**
 * Procedure that verifies the caller is an admin of the requested company.
 */
export const companyAdminProcedure = protectedProcedure
  .input(z.object({ companyId: z.string().uuid() }))
  .use(async ({ ctx, input, next }) => {
    const membership = await ctx.db.companyUser.findUnique({
      where: {
        companyId_userId: {
          companyId: input.companyId,
          userId: ctx.userId,
        },
      },
    });
    if (!membership || membership.role !== "admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Admin access required",
      });
    }
    return next({
      ctx: {
        ...ctx,
        companyId: input.companyId,
        companyRole: membership.role,
      },
    });
  });
