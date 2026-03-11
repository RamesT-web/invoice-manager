/**
 * API route for triggering Google Sheets sync.
 * Protected by CRON_SECRET header for automated calls.
 *
 * POST /api/sync/google-sheets
 * Headers: x-cron-secret: <CRON_SECRET>
 * Body: { companyId: string } or {} for all companies
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { runSync, runAllScheduledSyncs } from "@/lib/sync/sync-service";

export async function POST(req: NextRequest) {
  // Check authorization
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("x-cron-secret");

  if (!cronSecret || authHeader !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));

    if (body.companyId) {
      // Sync a specific company
      const entry = await runSync(body.companyId, db);
      return NextResponse.json(entry);
    } else {
      // Sync all companies
      await runAllScheduledSyncs(db);
      return NextResponse.json({ success: true, message: "All syncs completed" });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
