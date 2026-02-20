import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { storage } from "@/lib/storage";

export const attachmentRouter = router({
  /** List attachments for an entity */
  list: protectedProcedure
    .input(
      z.object({
        entityType: z.enum(["invoice", "vendor_bill"]),
        entityId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.attachment.findMany({
        where: {
          entityType: input.entityType,
          entityId: input.entityId,
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  /** Soft delete an attachment and remove file from storage */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const attachment = await ctx.db.attachment.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      });

      // Best-effort delete from storage
      await storage.delete(attachment.storagePath);

      return attachment;
    }),

  /** List all attachment records for backup (company-scoped) */
  backupIndex: protectedProcedure
    .input(z.object({ companyId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.attachment.findMany({
        where: {
          companyId: input.companyId,
          deletedAt: null,
        },
        select: {
          id: true,
          entityType: true,
          entityId: true,
          fileName: true,
          fileSize: true,
          mimeType: true,
          storagePath: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  /** Returns the active storage driver so the UI knows whether to bundle files */
  storageDriver: protectedProcedure.query(() => {
    return { driver: storage.driver };
  }),
});
