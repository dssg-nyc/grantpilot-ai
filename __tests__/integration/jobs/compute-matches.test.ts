// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// Minimal chainable stand-in for the supabase-js query builder: every filter
// method returns the builder, and awaiting it resolves to `result`.
function queryResult(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "not", "gte", "eq", "order", "limit"]) builder[m] = () => builder;
  builder.maybeSingle = () => Promise.resolve(result);
  builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

const upsert = vi.fn();
const orgsQuery = vi.fn();
// Records the filter chain of each `matches` delete (the stale-match prune).
const pruneCalls: Array<Array<[string, ...unknown[]]>> = [];
const pruneResult = vi.fn();

function deleteBuilder() {
  const calls: Array<[string, ...unknown[]]> = [];
  pruneCalls.push(calls);
  const builder: Record<string, unknown> = {};
  for (const m of ["eq", "not", "select"]) {
    builder[m] = (...args: unknown[]) => {
      calls.push([m, ...args]);
      return builder;
    };
  }
  builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(pruneResult()).then(resolve, reject);
  return builder;
}

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (table: string) =>
      table === "matches" ? { upsert, delete: deleteBuilder } : orgsQuery(),
  },
}));

vi.mock("@/lib/matching/vector-search", () => ({ vectorSimilaritySearch: vi.fn() }));
vi.mock("@/lib/anthropic/match-analyzer", () => ({ batchAnalyzeMatches: vi.fn() }));

// Real saveOrgMatches (against the mocked client); only the scoring is stubbed.
const computeMatchRowsForOrg = vi.fn();
vi.mock("@/lib/matching/compute", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/matching/compute")>()),
  computeMatchRowsForOrg: (...args: unknown[]) => computeMatchRowsForOrg(...args),
}));

const { computeMatchesForNewOpportunities } = await import("@/lib/jobs/handlers/compute-matches");
const { recomputeOrgMatches } = await import("@/lib/jobs/handlers/recompute-org-matches");

const ctx = { enqueue: vi.fn() };
const row = (orgId: string) => ({ org_id: orgId, opportunity_id: "opp-1", match_score: 80 });

beforeEach(() => {
  vi.clearAllMocks();
  pruneCalls.length = 0;
  upsert.mockResolvedValue({ error: null });
  pruneResult.mockReturnValue({ data: [], error: null });
});

describe("grants/new-opportunities handler", () => {
  it("computes and upserts matches for every org with an embedding", async () => {
    orgsQuery.mockReturnValue(queryResult({ data: [{ id: "a" }, { id: "b" }], error: null }));
    computeMatchRowsForOrg.mockImplementation(async (org: { id: string }) => [row(org.id)]);

    const result = await computeMatchesForNewOpportunities({}, ctx);

    expect(result).toEqual({ orgs_processed: 2, total_matches: 2, stale_pruned: 0 });
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenCalledWith([row("a")], { onConflict: "org_id,opportunity_id", ignoreDuplicates: false });
  });

  it("keeps going past a failing org, then throws so pg-boss retries", async () => {
    orgsQuery.mockReturnValue(queryResult({ data: [{ id: "a" }, { id: "b" }], error: null }));
    computeMatchRowsForOrg.mockImplementation(async (org: { id: string }) => {
      if (org.id === "a") throw new Error("boom");
      return [row(org.id)];
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(computeMatchesForNewOpportunities({}, ctx)).rejects.toThrow(/1\/2 orgs: a/);
    expect(upsert).toHaveBeenCalledWith([row("b")], expect.anything());
  });

  it("throws when the org query fails", async () => {
    orgsQuery.mockReturnValue(queryResult({ data: null, error: { message: "db down" } }));
    await expect(computeMatchesForNewOpportunities({}, ctx)).rejects.toThrow(/db down/);
  });
});

describe("org/profile-updated handler", () => {
  it("skips orgs without a profile embedding", async () => {
    orgsQuery.mockReturnValue(queryResult({ data: { id: "a", profile_embedding: null }, error: null }));
    const result = await recomputeOrgMatches({ org_id: "a" }, ctx);
    expect(result).toEqual({ skipped: true, reason: "No org or embedding" });
    expect(computeMatchRowsForOrg).not.toHaveBeenCalled();
  });

  it("recomputes and upserts one org's matches", async () => {
    orgsQuery.mockReturnValue(queryResult({ data: { id: "a", profile_embedding: [0.1] }, error: null }));
    computeMatchRowsForOrg.mockResolvedValue([row("a"), row("a")]);
    const result = await recomputeOrgMatches({ org_id: "a" }, ctx);
    expect(result).toEqual({ org_id: "a", matches_computed: 2, stale_pruned: 0 });
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("prunes only untouched matches that fell out of the new set", async () => {
    orgsQuery.mockReturnValue(queryResult({ data: { id: "a", profile_embedding: [0.1] }, error: null }));
    computeMatchRowsForOrg.mockResolvedValue([
      { ...row("a"), opportunity_id: "opp-1" },
      { ...row("a"), opportunity_id: "opp-2" },
    ]);
    pruneResult.mockReturnValue({ data: [{ id: "m-old" }], error: null });

    const result = await recomputeOrgMatches({ org_id: "a" }, ctx);

    expect(result).toEqual({ org_id: "a", matches_computed: 2, stale_pruned: 1 });
    expect(pruneCalls).toHaveLength(1);
    expect(pruneCalls[0]).toEqual(expect.arrayContaining([
      ["eq", "org_id", "a"],
      ["eq", "status", "new"],
      ["not", "opportunity_id", "in", "(opp-1,opp-2)"],
    ]));
  });

  it("never sends status in upserted rows, so user statuses survive", async () => {
    orgsQuery.mockReturnValue(queryResult({ data: { id: "a", profile_embedding: [0.1] }, error: null }));
    computeMatchRowsForOrg.mockResolvedValue([row("a")]);
    await recomputeOrgMatches({ org_id: "a" }, ctx);
    const [rows] = upsert.mock.calls[0];
    expect(rows[0]).not.toHaveProperty("status");
  });

  it("does not prune when the recompute produced nothing", async () => {
    orgsQuery.mockReturnValue(queryResult({ data: { id: "a", profile_embedding: [0.1] }, error: null }));
    computeMatchRowsForOrg.mockResolvedValue([]);
    await recomputeOrgMatches({ org_id: "a" }, ctx);
    expect(upsert).not.toHaveBeenCalled();
    expect(pruneCalls).toHaveLength(0);
  });
});
