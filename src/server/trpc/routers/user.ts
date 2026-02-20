import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { hash, compare } from "bcryptjs";
import { router, publicProcedure, protectedProcedure, companyAdminProcedure } from "../trpc";
import { registerLimiter } from "@/lib/rate-limit";

export const userRouter = router({
  /** Register a new user (public — for initial setup) */
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().min(1),
        phone: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Rate-limit registration (keyed by email domain as rough proxy)
      const domain = input.email.split("@")[1] ?? "unknown";
      const rl = registerLimiter.check(`register:${domain}`);
      if (!rl.success) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many registration attempts. Try again later.",
        });
      }

      const existing = await ctx.db.user.findUnique({
        where: { email: input.email },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Email already registered",
        });
      }

      const passwordHash = await hash(input.password, 12);
      const user = await ctx.db.user.create({
        data: {
          email: input.email,
          passwordHash,
          name: input.name,
          phone: input.phone,
        },
      });

      return { id: user.id, email: user.email, name: user.name };
    }),

  /** Get current user profile with companies */
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatarUrl: true,
        companyUsers: {
          include: { company: true },
          orderBy: { company: { name: "asc" } },
        },
      },
    });
    return user;
  }),

  /** Update profile */
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).optional(),
        phone: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.update({
        where: { id: ctx.userId },
        data: input,
      });
    }),

  /** Change password — requires current password verification */
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { passwordHash: true },
      });
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const valid = await compare(input.currentPassword, user.passwordHash);
      if (!valid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Current password is incorrect",
        });
      }

      const passwordHash = await hash(input.newPassword, 12);
      await ctx.db.user.update({
        where: { id: ctx.userId },
        data: { passwordHash },
      });
      return { success: true };
    }),

  // ─── Admin: User Management ──────────────────────────────

  /** List all users in a company (admin only) */
  listByCompany: companyAdminProcedure
    .query(async ({ ctx }) => {
      const companyUsers = await ctx.db.companyUser.findMany({
        where: { companyId: ctx.companyId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
              isActive: true,
              lastLoginAt: true,
              createdAt: true,
            },
          },
        },
        orderBy: { user: { name: "asc" } },
      });
      return companyUsers.map((cu) => ({
        ...cu.user,
        role: cu.role,
        companyUserId: cu.id,
      }));
    }),

  /** Toggle a user's active status (admin only) */
  toggleActive: companyAdminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Prevent admin from deactivating themselves
      if (input.userId === ctx.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot deactivate your own account",
        });
      }

      // Verify target user is in this company
      const target = await ctx.db.companyUser.findUnique({
        where: {
          companyId_userId: {
            companyId: ctx.companyId,
            userId: input.userId,
          },
        },
      });
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not in this company" });
      }

      await ctx.db.user.update({
        where: { id: input.userId },
        data: { isActive: input.isActive },
      });
      return { success: true };
    }),

  /** Reset a user's password (admin only — sets a temporary password) */
  adminResetPassword: companyAdminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        newPassword: z.string().min(8),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify target user is in this company
      const target = await ctx.db.companyUser.findUnique({
        where: {
          companyId_userId: {
            companyId: ctx.companyId,
            userId: input.userId,
          },
        },
      });
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not in this company" });
      }

      const passwordHash = await hash(input.newPassword, 12);
      await ctx.db.user.update({
        where: { id: input.userId },
        data: { passwordHash },
      });
      return { success: true };
    }),

  /** Change a user's role within a company (admin only) */
  changeRole: companyAdminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "accounts", "staff"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot change your own role",
        });
      }

      await ctx.db.companyUser.update({
        where: {
          companyId_userId: {
            companyId: ctx.companyId,
            userId: input.userId,
          },
        },
        data: { role: input.role },
      });
      return { success: true };
    }),
});
