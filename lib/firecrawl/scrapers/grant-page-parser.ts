import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
- focus_areas: string[] (e.g. ["education","health","environment"])
- eligibility_types: string[] (e.g. ["nonprofit_501c3","educational"])

If no grants are found, return [].
Return ONLY the JSON array.

CONTENT:
${markdown.substring(0, 14000)}`
      }]
    });

    const text = resp.content[0]?.type === "text" ? resp.content[0].text.trim() : "[]";
    const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const parsed = JSON.parse(clean);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
