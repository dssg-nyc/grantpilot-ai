import { NextResponse } from "next/server";

/**
 * In-memory sliding-window rate limiter.
 *
 * GrantPilot runs as a single Next.js process on one VPS, so per-process state
 * is authoritative — no Redis needed. If the app is ever scaled to multiple
 * instances, each instance enforces its own window (limits become per-instance).
 *
 * The path stays at lib/redis/ so existing route imports don't churn.
 */

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Epoch ms when the oldest counted request leaves the window. */
  reset: number;
}

interface LimiterOptions {
  /** Max requests per window. */
  limit: number;
  /** Window length in ms. */
  windowMs: number;
  /** Hard cap on tracked keys; the least-recently-touched key is dropped when full. */
  maxKeys?: number;
}

const EVICT_INTERVAL_MS = 60_000;

export class RateLimiter {
  readonly limitPerWindow: number;
  readonly windowMs: number;
  private readonly maxKeys: number;
  // Per key: ascending timestamps of requests still inside the window.
  // Map iteration order doubles as an LRU (keys are re-inserted on touch).
  private readonly hits = new Map<string, number[]>();

  constructor({ limit, windowMs, maxKeys = 10_000 }: LimiterOptions) {
    this.limitPerWindow = limit;
    this.windowMs = windowMs;
    this.maxKeys = maxKeys;
  }

  async limit(key: string, now: number = Date.now()): Promise<RateLimitResult> {
    const cutoff = now - this.windowMs;
    const stamps = this.prune(this.hits.get(key) ?? [], cutoff);

    const success = stamps.length < this.limitPerWindow;
    if (success) stamps.push(now);

    this.hits.delete(key);
    if (stamps.length > 0) {
      this.hits.set(key, stamps);
      if (this.hits.size > this.maxKeys) {
        const oldest = this.hits.keys().next().value;
        if (oldest !== undefined) this.hits.delete(oldest);
      }
    }

    return {
      success,
      limit: this.limitPerWindow,
      remaining: Math.max(0, this.limitPerWindow - stamps.length),
      reset: stamps.length > 0 ? stamps[0] + this.windowMs : now + this.windowMs,
    };
  }

  /** Drop every key whose requests have all aged out of the window. */
  evictExpired(now: number = Date.now()): void {
    const cutoff = now - this.windowMs;
    for (const [key, stamps] of this.hits) {
      if (stamps.length === 0 || stamps[stamps.length - 1] <= cutoff) this.hits.delete(key);
    }
  }

  /** Number of keys currently tracked (exposed for tests). */
  get size(): number {
    return this.hits.size;
  }

  private prune(stamps: number[], cutoff: number): number[] {
    let i = 0;
    while (i < stamps.length && stamps[i] <= cutoff) i++;
    return i === 0 ? stamps : stamps.slice(i);
  }
}

// Keep one limiter set per process even if Next loads this module in more than
// one bundle (or dev HMR re-evaluates it), so limits aren't silently split.
type LimiterRegistry = { default: RateLimiter; strict: RateLimiter; timer?: ReturnType<typeof setInterval> };
const globalForLimiter = globalThis as typeof globalThis & { __gpRateLimiters?: LimiterRegistry };

const registry: LimiterRegistry = (globalForLimiter.__gpRateLimiters ??= {
  default: new RateLimiter({ limit: 100, windowMs: 60_000 }),
  // Tighter limiter for expensive endpoints (LLM / scraping calls).
  strict: new RateLimiter({ limit: 10, windowMs: 60_000 }),
});

if (!registry.timer) {
  registry.timer = setInterval(() => {
    registry.default.evictExpired();
    registry.strict.evictExpired();
  }, EVICT_INTERVAL_MS);
  // Don't keep the process (or a test runner) alive just for eviction.
  registry.timer.unref?.();
}

export const rateLimiter = registry.default;
export const strictRateLimiter = registry.strict;

export async function withRateLimit(key: string) {
  const { success } = await rateLimiter.limit(key);
  if (!success) throw new Error("Rate limit exceeded");
}

/** Best-effort client identifier from proxy headers, falling back to a constant. */
export function clientKey(request: Request, scope: string): string {
  const fwd = request.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "anon";
  return `${scope}:${ip}`;
}

/**
 * Guard a route handler. Returns a 429 NextResponse when the caller is over the
 * limit, or null to proceed. A limiter error fails open rather than blocking.
 */
export async function rateLimitGuard(
  request: Request,
  scope: string,
  limiter: RateLimiter = rateLimiter,
): Promise<NextResponse | null> {
  try {
    const { success, limit, remaining, reset } = await limiter.limit(clientKey(request, scope));
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down and try again shortly." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))),
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": String(remaining),
          },
        },
      );
    }
    return null;
  } catch {
    return null;
  }
}
