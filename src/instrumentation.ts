/**
 * Next.js instrumentation file.
 * Runs once on server startup to initialize the sync scheduler.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startSyncScheduler } = await import("@/lib/sync/cron-scheduler");
    startSyncScheduler();
  }
}
