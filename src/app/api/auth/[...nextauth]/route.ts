import { NextRequest, NextResponse } from "next/server";
import { handlers } from "@/lib/auth";
import { authLimiter } from "@/lib/rate-limit";

/**
 * Rate-limit the credential POST (sign-in) to prevent brute-force.
 * GET (session/csrf) passes through unthrottled.
 */
const originalPost = handlers.POST;

async function rateLimitedPost(req: NextRequest) {
  // Rate-limit by IP
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const result = authLimiter.check(`auth:${ip}`);

  if (!result.success) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(result.retryAfterMs / 1000)),
        },
      }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return originalPost(req as any);
}

export const GET = handlers.GET;
export const POST = rateLimitedPost;
