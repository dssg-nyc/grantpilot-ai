import Anthropic from "@anthropic-ai/sdk";
import { FOCUS_AREA_TAXONOMY } from "@/lib/utils/taxonomy";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const VALID_FOCUS_AREAS = new Set<string>(FOCUS_AREA_TAXONOMY);
const VALID_ELIGIBILITY_TYPES = new Set([
  "nonprofit_501c3", "nonprofit_other", "educational", "government", "individual", "any",
]);

export interface ExtractedGrant {
  title: string;
  description: string;
  deadline: string | null;
  amount_min: number | null;
  amount_max: number | null;
  application_url: string | null;
  focus_areas: string[];
  eligibility_types: string[];
}

export async function extractOpportunitiesFromMarkdown(
  markdown: string,
  funderName: string
): Promise<ExtractedGrant[]> {
  if (!markdown.trim()) return [];

  try {
    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: `Extract all grant opportunities from this webpage content for ${funderName}. Return ONLY a raw JSON array (no markdown, no code blocks).

Each item must have these exact fields:
- title: string (grant/program name)
- description: string (1-3 sentence summary)
- deadline: string | null (ISO date YYYY-MM-DD or null)
- amount_min: number | null (minimum award in USD, or null)
- amount_max: number | null (maximum award in USD, or null)
- application_url: string | null (direct application link or null)
- focus_areas: string[] (1-3 values chosen ONLY from this exact list — do not invent new ones, pick the closest matches: ${JSON.stringify(FOCUS_AREA_TAXONOMY)})
- eligibility_types: string[] (values chosen ONLY from: ["nonprofit_501c3","nonprofit_other","educational","government","individual","any"])

If no grants are found, return [].
Return ONLY the JSON array.

CONTENT:
${markdown.substring(0, 14000)}`
      }]
    });

    const text = resp.content[0]?.type === "text" ? resp.content[0].text.trim() : "[]";
    const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const parsed = JSON.parse(clean);
    if (!Array.isArray(parsed)) return [];
    // Belt-and-suspenders: even with the constrained-list prompt above,
    // don't trust the model to always stay on-list — filter here so
    // off-taxonomy values (which silently never match/filter correctly
    // downstream) can't slip through.
    return parsed.map((g: ExtractedGrant) => ({
      ...g,
      focus_areas: (g.focus_areas ?? []).filter((a) => VALID_FOCUS_AREAS.has(a)),
      eligibility_types: (g.eligibility_types ?? []).filter((e) => VALID_ELIGIBILITY_TYPES.has(e)),
    }));
  } catch {
    return [];
  }
}
