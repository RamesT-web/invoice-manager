/**
 * Cron scheduler for automatic Google Sheets sync.
 * Runs twice daily at 8:00 AM and 6:00 PM.
 */

import * as cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import { runAllScheduledSyncs } from "./sync-service";

let task: ReturnType<typeof cron.schedule> | null = null;
let dbInstance: PrismaClient | null = null;

/**
 * Start the sync scheduler.
 * Runs at 8:00 AM and 6:00 PM every day.
 */
export function startSyncScheduler(): void {
  if (task) {
    console.log("[Sync Scheduler] Already running.");
    return;
  }

  dbInstance = new PrismaClient();

  // "0 8,18 * * *" = at minute 0, hours 8 and 18, every day
  task = cron.schedule("0 8,18 * * *", async () => {
    try {
      await runAllScheduledSyncs(dbInstance!);
    } catch (err) {
      console.error("[Sync Scheduler] Fatal error:", err);
    }
  });

  console.log("[Sync Scheduler] Started. Syncs scheduled at 8:00 AM and 6:00 PM daily.");
}

/**
 * Stop the sync scheduler.
 */
export function stopSyncScheduler(): void {
  if (task) {
    task.stop();
    task = null;
  }
  if (dbInstance) {
    dbInstance.$disconnect().catch(() => {});
    dbInstance = null;
  }
  console.log("[Sync Scheduler] Stopped.");
}
