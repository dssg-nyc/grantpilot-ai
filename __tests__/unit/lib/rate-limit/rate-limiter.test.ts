// @vitest-environment node
import { describe, expect, it } from "vitest";
import { RateLimiter, clientKey, rateLimitGuard } from "@/lib/redis/rate-limiter";

function req(ip: string) {
  return new Request("http://localhost/api/x", { headers: { "x-forwarded-for": `${ip}, 10.0.0.1` } });
}

describe("RateLimiter (in-memory sliding window)", () => {
  it("allows up to the limit then blocks within the window", async () => {
    const rl = new RateLimiter({ limit: 3, windowMs: 1000 });
    const t = 1_000_000;
    expect((await rl.limit("k", t)).remaining).toBe(2);
    await rl.limit("k", t + 1);
    const third = await rl.limit("k", t + 2);
    expect(third.success).toBe(true);
    expect(third.remaining).toBe(0);
    const fourth = await rl.limit("k", t + 3);
    expect(fourth.success).toBe(false);
    expect(fourth.reset).toBe(t + 1000);
  });

  it("slides: frees capacity as the oldest hits age out", async () => {
    const rl = new RateLimiter({ limit: 2, windowMs: 1000 });
    const t = 5_000;
    await rl.limit("k", t);
    await rl.limit("k", t + 500);
    expect((await rl.limit("k", t + 900)).success).toBe(false);
    // First hit leaves the window at t+1000, second is still counted.
    const r = await rl.limit("k", t + 1001);
    expect(r.success).toBe(true);
    expect(r.remaining).toBe(0);
  });

  it("isolates keys", async () => {
    const rl = new RateLimiter({ limit: 1, windowMs: 1000 });
    expect((await rl.limit("a", 0)).success).toBe(true);
    expect((await rl.limit("a", 1)).success).toBe(false);
    expect((await rl.limit("b", 1)).success).toBe(true);
  });

  it("evicts expired keys and caps tracked keys", async () => {
    const rl = new RateLimiter({ limit: 5, windowMs: 1000, maxKeys: 3 });
    for (const k of ["a", "b", "c", "d"]) await rl.limit(k, 0);
    expect(rl.size).toBe(3);
    rl.evictExpired(500);
    expect(rl.size).toBe(3);
    rl.evictExpired(1001);
    expect(rl.size).toBe(0);
  });
});

describe("rateLimitGuard", () => {
  it("returns null under the limit and a 429 with headers over it", async () => {
    const rl = new RateLimiter({ limit: 1, windowMs: 60_000 });
    expect(await rateLimitGuard(req("1.2.3.4"), "test", rl)).toBeNull();
    const res = await rateLimitGuard(req("1.2.3.4"), "test", rl);
    expect(res?.status).toBe(429);
    expect(res?.headers.get("X-RateLimit-Limit")).toBe("1");
    expect(res?.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(Number(res?.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await res?.json()).toEqual({ error: expect.stringMatching(/too many requests/i) });
    // A different IP is unaffected.
    expect(await rateLimitGuard(req("5.6.7.8"), "test", rl)).toBeNull();
  });

  it("fails open if the limiter throws", async () => {
    const broken = { limit: () => Promise.reject(new Error("boom")) } as unknown as RateLimiter;
    expect(await rateLimitGuard(req("1.1.1.1"), "test", broken)).toBeNull();
  });

  it("clientKey uses the first forwarded IP", () => {
    expect(clientKey(req("9.9.9.9"), "s")).toBe("s:9.9.9.9");
    expect(clientKey(new Request("http://x"), "s")).toBe("s:anon");
  });
});
