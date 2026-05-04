import { describe, expect, it } from "vitest";
import { FOCUS_AREA_TAXONOMY } from "@/lib/utils/taxonomy";

describe("taxonomy", () => {
  it("contains education", () => {
    expect(FOCUS_AREA_TAXONOMY).toContain("Education");
  });
});
