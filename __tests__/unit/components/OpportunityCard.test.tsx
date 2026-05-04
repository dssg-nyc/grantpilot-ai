import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import OpportunityCard from "@/components/opportunities/OpportunityCard";

describe("OpportunityCard", () => {
  it("renders title", () => {
    render(
      <OpportunityCard
        opportunity={{
          id: "1",
          title: "Sample Grant",
          funder_name: "Sample",
          funder_type: "foundation",
          funding_type: "grant",
          eligibility_types: [],
          focus_areas: [],
          source: "manual",
          source_url: "#",
          status: "active",
        }}
      />,
    );
    expect(screen.getByText("Sample Grant")).toBeDefined();
  });
});
