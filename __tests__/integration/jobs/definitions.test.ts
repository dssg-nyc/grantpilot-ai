// @vitest-environment node
import { describe, expect, it } from "vitest";
import { JOBS, JOB_DEFINITIONS, isJobName } from "@/lib/jobs/definitions";

describe("job definitions", () => {
  it("keeps the event names callers send", () => {
    expect(JOBS.syncGrantsGov).toBe("grants/sync.requested");
    expect(JOBS.computeMatches).toBe("grants/new-opportunities");
    expect(JOBS.recomputeOrgMatches).toBe("org/profile-updated");
  });

  it("defines a queue for every job name", () => {
    expect(Object.keys(JOB_DEFINITIONS).sort()).toEqual(Object.values(JOBS).sort());
    expect(isJobName("org/profile-updated")).toBe(true);
    expect(isJobName("not-a-job")).toBe(false);
  });

  it("keeps the same cron triggers the Inngest functions had", () => {
    const crons = Object.fromEntries(
      Object.entries(JOB_DEFINITIONS).filter(([, d]) => d.cron).map(([n, d]) => [n, d.cron]),
    );
    expect(crons).toEqual({
      "grants/sync.requested": "0 */4 * * *",
      "sync-sam-gov": "0 2 * * *",
      "monitor-rss": "0 */4 * * *",
      "crawl-foundations": "0 6 * * *",
      "send-digest-emails": "0 9 * * 1",
      "update-trending-scores": "0 * * * *",
    });
  });

  it("only uses valid pg-boss queue names and expirations", () => {
    for (const [name, def] of Object.entries(JOB_DEFINITIONS)) {
      expect(name).toMatch(/^[\w.\-/]+$/);
      expect(def.queue.expireInSeconds ?? 0).toBeLessThanOrEqual(24 * 60 * 60);
    }
  });
});
