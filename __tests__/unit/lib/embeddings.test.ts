import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildOpportunityEmbeddingText,
  buildOrgEmbeddingText,
  embedText,
  embedTexts,
} from "@/lib/embeddings";

const vec = (n = 1024, v = 0.1) => Array.from({ length: n }, () => v);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("embeddings (Ollama)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    delete process.env.OLLAMA_URL;
    delete process.env.EMBEDDING_MODEL;
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("posts to Ollama /api/embed with the default model", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ embeddings: [vec()] }));
    const out = await embedText("hello");
    expect(out).toHaveLength(1024);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:11434/api/embed");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("bge-m3");
    expect(body.input).toEqual(["hello"]);
  });

  it("honours OLLAMA_URL and EMBEDDING_MODEL", async () => {
    process.env.OLLAMA_URL = "http://ollama:11434/";
    process.env.EMBEDDING_MODEL = "custom";
    fetchMock.mockResolvedValueOnce(jsonResponse({ embeddings: [vec()] }));
    await embedText("x");
    expect(fetchMock.mock.calls[0][0]).toBe("http://ollama:11434/api/embed");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe("custom");
  });

  it("returns empty vectors for blank inputs without calling Ollama", async () => {
    expect(await embedText("   ")).toEqual([]);
    expect(await embedTexts(["", "  "])).toEqual([[], []]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves input order around blanks and chunks into requests of 32", async () => {
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const { input } = JSON.parse(init.body as string) as { input: string[] };
      return jsonResponse({ embeddings: input.map((t) => vec(1024, Number(t))) });
    });
    const inputs = Array.from({ length: 70 }, (_, i) => (i === 5 ? "" : String(i)));
    const out = await embedTexts(inputs);
    expect(fetchMock).toHaveBeenCalledTimes(3); // 69 non-blank -> 32 + 32 + 5
    expect(out[5]).toEqual([]);
    expect(out[69][0]).toBe(69);
    expect(out[6][0]).toBe(6);
  });

  it("truncates very long inputs", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ embeddings: [vec()] }));
    await embedText("a".repeat(100_000));
    const { input } = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(input[0].length).toBeLessThanOrEqual(2000);
  });

  it("retries on 5xx and network errors, then succeeds", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response("boom", { status: 503 }))
      .mockResolvedValueOnce(jsonResponse({ embeddings: [vec()] }));
    const p = embedText("x");
    await vi.runAllTimersAsync();
    expect(await p).toHaveLength(1024);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("gives up after max retries with empty vectors", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const p = embedTexts(["a", "b"], 2);
    await vi.runAllTimersAsync();
    expect(await p).toEqual([[], []]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry 4xx (e.g. model not pulled)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "model not found" }, 404));
    expect(await embedText("x")).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("discards vectors with the wrong dimensionality", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ embeddings: [vec(768)] }));
    expect(await embedText("x")).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });
});

describe("embedding text builders", () => {
  it("builds opportunity text, falling back to title and adding eligibility", () => {
    expect(buildOpportunityEmbeddingText({ title: "T", description: null, funder_name: "F" })).toBe("T\nT\nFunder: F");
    expect(
      buildOpportunityEmbeddingText({ title: "T", description: "D", funder_name: "F", eligibility_types: ["a", "b"] }),
    ).toBe("T\nD\nFunder: F\nEligibility: a, b");
  });

  it("builds org text like the profile route", () => {
    const text = buildOrgEmbeddingText({
      mission_statement: "M",
      primary_focus_areas: ["Education"],
      target_beneficiaries: null,
      programs: [{ name: "P", description: "d" }],
      annual_budget_range: "100k",
    });
    expect(text).toBe("M\nFocus areas: Education\nBeneficiaries: \nPrograms: P: d\nBudget: 100k\nService area: national");
  });
});
