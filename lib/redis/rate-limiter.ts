import { Ratelimit } from "@upstash/ratelimit";
import { NextResponse } from "next/server";
import { redis } from "@/lib/redis/client";

export const rateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, "1 m"),
  analytics: true,
});

// Tighter limiter for expensive endpoints (LLM / scraping calls).
export const strictRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  analytics: true,
  prefix: "rl:strict",
});

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
 * limit, or null to proceed. Upstash isn't configured in some local setups, so
 * a limiter error fails open rather than blocking the request.
 */
export async function rateLimitGuard(
  request: Request,
  scope: string,
  limiter: Ratelimit = rateLimiter,
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
