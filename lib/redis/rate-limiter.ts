import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/lib/redis/client";

export const rateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, "1 m"),
  analytics: true,
});

export async function withRateLimit(key: string) {
  const { success } = await rateLimiter.limit(key);
  if (!success) throw new Error("Rate limit exceeded");
}
