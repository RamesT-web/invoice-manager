import { NextResponse } from "next/server";

/**
 * Next.js Edge Middleware
 * - Adds security response headers to every request
 * - Rate-limit enforcement is in the route handlers (edge middleware
 *   cannot share the in-memory store with the Node runtime)
 */
export function middleware() {
  const res = NextResponse.next();

  // ── Security headers ──────────────────────────────────────
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-XSS-Protection", "1; mode=block");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  // HSTS — only in production (behind HTTPS)
  if (process.env.NODE_ENV === "production") {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }

  return res;
}

export const config = {
  // Run on all routes except static files & images
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.*|sw.js|manifest.json|offline.html|.well-known).*)"],
};
