import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { extractSpreadsheetId } from "@/lib/sync/google-sheets";
import { runSync, type SyncConfig, type SyncLogEntry } from "@/lib/sync/sync-service";

export const googleSheetsRouter = router({
  /** Get sync config for a company */
  getConfig: protectedProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const setting = await ctx.db.setting.findUnique({
        where: {
          companyId_key: { companyId: input.companyId, key: "google_sheets_sync" },
        },
      });
      if (!setting) return null;
      return setting.value as unknown as SyncConfig;
    }),

  /** Save sync config */
  saveConfig: protectedProcedure
    .input(
      z.object({
        companyId: z.string(),
        spreadsheetUrl: z.string(),
        apiKey: z.string().optional(),
        enabled: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let spreadsheetId = "";
      if (input.spreadsheetUrl) {
        spreadsheetId = extractSpreadsheetId(input.spreadsheetUrl);
      }

      const config: SyncConfig = {
        spreadsheetId,
        apiKey: input.apiKey || "",
        enabled: input.enabled,
      };

      await ctx.db.setting.upsert({
        where: {
          companyId_key: { companyId: input.companyId, key: "google_sheets_sync" },
        },
        create: {
          companyId: input.companyId,
          key: "google_sheets_sync",
          value: config as any,
          updatedBy: ctx.session.user?.id as string,
        },
        update: {
          value: config as any,
          updatedBy: ctx.session.user?.id as string,
        },
      });

      return { success: true, spreadsheetId };
    }),

  /** Get last sync result */
  getLastSync: protectedProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ ctx, input }) => {
      const setting = await ctx.db.setting.findUnique({
        where: {
          companyId_key: { companyId: input.companyId, key: "google_sheets_sync_log" },
        },
      });
      if (!setting) return null;
      return setting.value as unknown as SyncLogEntry;
    }),

  /** Trigger immediate sync */
  syncNow: protectedProcedure
    .input(z.object({ companyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const entry = await runSync(input.companyId, ctx.db);
      return entry;
    }),
});
