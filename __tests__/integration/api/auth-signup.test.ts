import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { signUp, upsert, fromMock, rateLimitGuardMock } = vi.hoisted(() => ({
  signUp: vi.fn(),
  upsert: vi.fn(async () => ({ error: null })),
  fromMock: vi.fn(),
  rateLimitGuardMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { signUp },
    from: fromMock,
  })),
}));

vi.mock("@/lib/redis/rate-limiter", () => ({
  rateLimitGuard: rateLimitGuardMock,
  strictRateLimiter: {},
}));

import { POST } from "@/app/api/auth/signup/route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    signUp.mockReset();
    upsert.mockClear();
    fromMock.mockReset();
    fromMock.mockReturnValue({ upsert });
    rateLimitGuardMock.mockReset();
    rateLimitGuardMock.mockResolvedValue(null);
  });

  it("returns 400 for a malformed JSON body without calling Supabase", async () => {
    const req = new Request("http://localhost/api/auth/signup", {
      method: "POST",
      body: "{not valid json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid request");
    expect(signUp).not.toHaveBeenCalled();
  });

  it("returns 400 when email or password is missing", async () => {
    const res = await POST(makeRequest({ email: "a@example.com" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Email and password are required");
    expect(signUp).not.toHaveBeenCalled();
  });

  it("returns 400 with the Supabase error message when signUp fails", async () => {
    signUp.mockResolvedValue({ data: { user: null, session: null }, error: { message: "Email already registered" } });
    const res = await POST(makeRequest({ email: "dup@example.com", password: "hunter2222" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Email already registered");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("returns verifyPending:true and skips the users upsert when email confirmation is required", async () => {
    signUp.mockResolvedValue({
      data: { user: { id: "user-1", email: "a@example.com" }, session: null },
      error: null,
    });
    const res = await POST(makeRequest({ email: "a@example.com", password: "hunter2222" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.verifyPending).toBe(true);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("upserts the new user row and returns success:true on a fully confirmed signup", async () => {
    signUp.mockResolvedValue({
      data: {
        user: { id: "user-1", email: "a@example.com" },
        session: { access_token: "tok" },
      },
      error: null,
    });
    const res = await POST(makeRequest({ email: "a@example.com", password: "hunter2222", full_name: "Ada" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(fromMock).toHaveBeenCalledWith("users");
    expect(upsert).toHaveBeenCalledWith({
      id: "user-1",
      email: "a@example.com",
      role: "org_admin",
      onboarding_completed: false,
    });
  });

  it("passes full_name through to Supabase signUp metadata, defaulting to empty string", async () => {
    signUp.mockResolvedValue({ data: { user: null, session: null }, error: null });
    await POST(makeRequest({ email: "a@example.com", password: "hunter2222" }));
    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "a@example.com",
        password: "hunter2222",
        options: expect.objectContaining({ data: { full_name: "" } }),
      }),
    );
  });

  it("short-circuits with the rate limiter's response when rate limited, without calling Supabase", async () => {
    const limitedResponse = NextResponse.json(
      { error: "Too many requests. Please slow down and try again shortly." },
      { status: 429 },
    );
    rateLimitGuardMock.mockResolvedValue(limitedResponse);

    const res = await POST(makeRequest({ email: "a@example.com", password: "hunter2222" }));
    expect(res.status).toBe(429);
    expect(signUp).not.toHaveBeenCalled();
  });
});
