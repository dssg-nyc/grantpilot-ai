import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { signInWithPassword, rateLimitGuardMock } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  rateLimitGuardMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { signInWithPassword },
  })),
}));

vi.mock("@/lib/redis/rate-limiter", () => ({
  rateLimitGuard: rateLimitGuardMock,
  strictRateLimiter: {},
}));

import { POST } from "@/app/api/auth/login/route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    signInWithPassword.mockReset();
    rateLimitGuardMock.mockReset();
    rateLimitGuardMock.mockResolvedValue(null);
  });

  it("returns 400 for a malformed JSON body without calling Supabase", async () => {
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: "{not valid json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid request");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("returns 400 when email is missing", async () => {
    const res = await POST(makeRequest({ password: "hunter2" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Email and password are required");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("returns 400 when password is missing", async () => {
    const res = await POST(makeRequest({ email: "a@example.com" }));
    expect(res.status).toBe(400);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("returns 401 with the Supabase error message on invalid credentials", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    const res = await POST(makeRequest({ email: "a@example.com", password: "wrong" }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Invalid login credentials");
  });

  it("returns success:true and forwards credentials to Supabase on a valid login", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    const res = await POST(makeRequest({ email: "a@example.com", password: "correct-horse" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "a@example.com",
      password: "correct-horse",
    });
  });

  it("short-circuits with the rate limiter's response when rate limited, without calling Supabase", async () => {
    const limitedResponse = NextResponse.json(
      { error: "Too many requests. Please slow down and try again shortly." },
      { status: 429 },
    );
    rateLimitGuardMock.mockResolvedValue(limitedResponse);

    const res = await POST(makeRequest({ email: "a@example.com", password: "correct-horse" }));
    expect(res.status).toBe(429);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});
