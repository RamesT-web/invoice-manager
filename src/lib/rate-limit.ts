/**
 * Simple in-memory sliding-window rate limiter.
 * Good enough for a single-process deployment. For multi-instance,
 * swap to Redis-backed (e.g. @upstash/ratelimit).
 */

interface SlidingWindowEntry {
  timestamps: number[];
}

const store = new Map<string, SlidingWindowEntry>();

// Periodically clean stale entries (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup(windowMs: number) {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    store.forEach((entry, key) => {
      entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
      if (entry.timestamps.length === 0) store.delete(key);
    });
  }, CLEANUP_INTERVAL);
  // Don't prevent process exit
  if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

export interface RateLimitConfig {
  /** Max requests allowed in the window */
  max: number;
  /** Window size in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  /** Remaining requests in this window */
  remaining: number;
  /** Milliseconds until the oldest request expires */
  retryAfterMs: number;
}

/**
 * Create a rate limiter with the given config.
 * Returns a `check(key)` function.
 */
export function createRateLimiter(config: RateLimitConfig) {
  ensureCleanup(config.windowMs);

  return {
    check(key: string): RateLimitResult {
      const now = Date.now();
      let entry = store.get(key);

      if (!entry) {
        entry = { timestamps: [] };
        store.set(key, entry);
      }

      // Remove expired timestamps
      entry.timestamps = entry.timestamps.filter(
        (t) => now - t < config.windowMs
      );

      if (entry.timestamps.length >= config.max) {
        const oldest = entry.timestamps[0]!;
        return {
          success: false,
          remaining: 0,
          retryAfterMs: config.windowMs - (now - oldest),
        };
      }

      entry.timestamps.push(now);
      return {
        success: true,
        remaining: config.max - entry.timestamps.length,
        retryAfterMs: 0,
      };
    },
  };
}

// ─── Pre-configured limiters ────────────────────────────────

/** Auth endpoints: 10 attempts per 15 minutes per IP */
export const authLimiter = createRateLimiter({
  max: 10,
  windowMs: 15 * 60 * 1000,
});

/** Registration: 3 accounts per hour per IP */
export const registerLimiter = createRateLimiter({
  max: 3,
  windowMs: 60 * 60 * 1000,
});

/** File uploads: 30 per 10 minutes per user */
export const uploadLimiter = createRateLimiter({
  max: 30,
  windowMs: 10 * 60 * 1000,
});

/** General API: 200 requests per minute per user */
export const apiLimiter = createRateLimiter({
  max: 200,
  windowMs: 60 * 1000,
});
