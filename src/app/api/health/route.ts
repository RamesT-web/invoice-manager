import { NextResponse } from "next/server";
import { db } from "@/server/db";

/**
 * GET /api/health
 *
 * Returns basic health status. Useful for uptime monitors,
 * load-balancer checks, and Render / Railway zero-downtime deploys.
 */
export async function GET() {
  const start = Date.now();
  let dbOk = false;

  try {
    // Quick DB ping — runs a trivial query
    await db.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    // DB is unreachable
  }

  const uptimeSeconds = Math.floor(process.uptime());
  const latencyMs = Date.now() - start;

  const status = dbOk ? "healthy" : "degraded";
  const httpStatus = dbOk ? 200 : 503;

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      uptime: uptimeSeconds,
      db: dbOk ? "connected" : "unreachable",
      latencyMs,
      version: process.env.npm_package_version ?? "0.1.0",
    },
    { status: httpStatus }
  );
}

// Disable static generation — must be dynamic
export const dynamic = "force-dynamic";
