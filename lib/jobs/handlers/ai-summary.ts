import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * 2-sentence plain-English summary used by the RSS and SAM.gov ingesters.
 * Best-effort: returns "" on any failure so ingestion never blocks on Claude.
 */
export async function generateAISummary(
  title: string,
  description: string,
  kind: "grant" | "grant/contract" = "grant",
): Promise<string> {
  const instructions =
    kind === "grant"
      ? "Write exactly 2 plain English sentences summarizing this grant opportunity. No markdown, no headers, no bullet points."
      : "Write exactly 2 plain English sentences summarizing this grant/contract opportunity. No markdown.";
  try {
    const resp = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [{ role: "user", content: `${instructions}\n\nTitle: ${title}\nDescription: ${description.substring(0, 600)}\n\nSummary:` }],
    });
    return resp.content[0]?.type === "text" ? resp.content[0].text.trim() : "";
  } catch { return ""; }
}
