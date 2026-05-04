import { describe, expect, it } from "vitest";
import { computeCompositeScore } from "@/lib/matching/score-calculator";

describe("computeCompositeScore", () => {
  it("returns high score for strong match", () => {
    const score = computeCompositeScore(
      {
        legal_name: "Org",
        org_type: "ngo",
        primary_focus_areas: ["Education"],
        secondary_focus_areas: [],
        target_beneficiaries: [],
        geographic_service_area: "state",
        service_states: ["CA"],
        service_cities: [],
        sdg_alignments: [],
        programs: [],
        annual_budget_range: "50k_250k",
      },
      {
        id: "1",
        title: "Edu Grant",
        funder_name: "Funder",
        funder_type: "foundation",
        funding_type: "grant",
        eligibility_types: ["any"],
        focus_areas: ["Education"],
        geographic_scope: "national",
        source: "manual",
        source_url: "#",
        status: "active",
      },
      0.9,
    );

    expect(score).toBeGreaterThan(70);
  });
});
