/**
 * Sync orchestrator: coordinates Google Sheets fetch + import for a company.
 */

import { PrismaClient } from "@prisma/client";
import { fetchSheetAsWorkbook } from "./google-sheets";
import { importFromWorkbook, type SyncResult } from "./import-core";

export interface SyncConfig {
  spreadsheetId: string;
  apiKey: string;
  enabled: boolean;
  salesSheetName?: string;
  purchaseSheetName?: string;
}

export interface SyncLogEntry {
  timestamp: string;
  success: boolean;
  result?: SyncResult;
  error?: string;
  durationMs: number;
}

/**
 * Run sync for a single company.
 */
export async function runSync(
  companyId: string,
  db: PrismaClient,
  options?: { force?: boolean }
): Promise<SyncLogEntry> {
  const startTime = Date.now();

  try {
    // 1. Read sync config from Settings
    const configSetting = await db.setting.findUnique({
      where: { companyId_key: { companyId, key: "google_sheets_sync" } },
    });

    if (!configSetting) {
      throw new Error("Google Sheets sync not configured for this company.");
    }

    const config = configSetting.value as unknown as SyncConfig;

    if (!config.enabled && !options?.force) {
      throw new Error("Sync is disabled for this company.");
    }

    if (!config.spreadsheetId) {
      throw new Error("No spreadsheet ID configured.");
    }

    // 2. Fetch the spreadsheet as a workbook
    const wb = await fetchSheetAsWorkbook(config.spreadsheetId, {
      type: "api_key",
      key: config.apiKey || "",
    });

    // 3. Run import
    const result = await importFromWorkbook(wb, companyId, db, {
      dryRun: false,
      logFn: (msg) => console.log(`[Sync ${companyId.slice(0, 8)}] ${msg}`),
    });

    const entry: SyncLogEntry = {
      timestamp: new Date().toISOString(),
      success: true,
      result,
      durationMs: Date.now() - startTime,
    };

    // 4. Save sync log
    await db.setting.upsert({
      where: { companyId_key: { companyId, key: "google_sheets_sync_log" } },
      create: { companyId, key: "google_sheets_sync_log", value: entry as any },
      update: { value: entry as any },
    });

    return entry;
  } catch (err: any) {
    const entry: SyncLogEntry = {
      timestamp: new Date().toISOString(),
      success: false,
      error: err.message || "Unknown error",
      durationMs: Date.now() - startTime,
    };

    // Save error log
    try {
      await db.setting.upsert({
        where: { companyId_key: { companyId, key: "google_sheets_sync_log" } },
        create: { companyId, key: "google_sheets_sync_log", value: entry as any },
        update: { value: entry as any },
      });
    } catch {
      // Ignore log save errors
    }

    return entry;
  }
}

/**
 * Run sync for all companies that have sync enabled.
 */
export async function runAllScheduledSyncs(db: PrismaClient): Promise<void> {
  console.log(`[Sync Scheduler] Starting scheduled sync at ${new Date().toISOString()}`);

  // Find all companies with enabled sync config
  const syncSettings = await db.setting.findMany({
    where: { key: "google_sheets_sync" },
  });

  let syncCount = 0;
  for (const setting of syncSettings) {
    const config = setting.value as unknown as SyncConfig;
    if (!config.enabled || !config.spreadsheetId) continue;

    console.log(`[Sync Scheduler] Syncing company ${setting.companyId}...`);
    const entry = await runSync(setting.companyId, db);

    if (entry.success) {
      console.log(`[Sync Scheduler] Company ${setting.companyId}: OK (${entry.durationMs}ms)`);
    } else {
      console.error(`[Sync Scheduler] Company ${setting.companyId}: FAILED - ${entry.error}`);
    }
    syncCount++;
  }

  if (syncCount === 0) {
    console.log("[Sync Scheduler] No companies have sync enabled.");
  } else {
    console.log(`[Sync Scheduler] Completed ${syncCount} syncs.`);
  }
}
