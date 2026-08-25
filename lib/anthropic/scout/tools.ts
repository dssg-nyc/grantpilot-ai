import type Anthropic from "@anthropic-ai/sdk";
import { FOCUS_AREA_TAXONOMY } from "@/lib/utils/taxonomy";
import { SCOUT_FUNDER_TYPES } from "@/types/scout";

/**
 * Anthropic-hosted server tools. The model issues the query and Anthropic's
 * own infrastructure runs the search / fetch — no external search API key of
 * ours involved. web_fetch can only fetch URLs already present in the
 * conversation, which in practice means URLs web_search surfaced, so the two
 * are always declared together.
 *
 * max_uses is the runtime governor for the whole feature: each search and
 * each page fetch costs seconds of wall-clock, and this route has to finish
 * inside the platform's function timeout. Raise these only alongside
 * maxDuration in app/api/scout/route.ts.
 */
const WEB_SEARCH_TOOL: Anthropic.WebSearchTool20260209 = {
  type: "web_search_20260209",
  name: "web_search",
  max_uses: 10,
};

const WEB_FETCH_TOOL: Anthropic.WebFetchTool20260209 = {
  type: "web_fetch_20260209",
  name: "web_fetch",
  max_uses: 10,
  // Funder program pages are mostly boilerplate; this keeps a single long
  // page from crowding out the rest of the research in the context window.
  max_content_tokens: 12000,
};

export const SCOUT_TOOLS: Anthropic.ToolUnion[] = [
  WEB_SEARCH_TOOL,
  WEB_FETCH_TOOL,
  {
    name: "check_known_opportunities",
    description:
      "Search the grants this app has ALREADY ingested and vetted (federal grants.gov listings plus a curated foundation set). Use this early, before recording findings, so you can tell the user which of your web finds are genuinely new versus already sitting in their dashboard. Do not use it as your primary search — your job is to find what this database does NOT have.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Topic or funder name to check for, e.g. 'youth mental health' or 'Hewlett Foundation'." },
        limit: { type: "number", description: "Max results, default 5." },
      },
      required: ["query"],
    },
  },
  {
    name: "record_funding_opportunity",
    description:
      "Record ONE funding opportunity you have found and verified on the web. Call this once per opportunity, as soon as you have confirmed it — do not batch them up until the end, because the user watches results appear live. Only record an opportunity after you have actually read the funder's own page for it (via web_fetch or a substantive web_search result), never from a directory listing or a 'top 10 grants' article alone. Every field you fill in must come from that page; leave a field out entirely rather than guessing at it.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "The name of the grant, fund, or funding program as the funder writes it." },
        funder_name: { type: "string", description: "The organization giving the money." },
        funder_type: { type: "string", enum: [...SCOUT_FUNDER_TYPES] },
        source_url: {
          type: "string",
          description:
            "Direct URL to the funder's own page describing this opportunity — the page you read. This is what the user clicks to verify you. Never a search-results page, a news article about the grant, or a generic homepage.",
        },
        application_url: { type: "string", description: "URL to apply or to the application portal, if the page gives a distinct one." },
        program_summary: { type: "string", description: "2-4 sentences: what this funds, who it is for, and how it works." },
        amount_min: { type: "number", description: "Smallest typical award in USD, if stated." },
        amount_max: { type: "number", description: "Largest typical award in USD, if stated." },
        amount_note: { type: "string", description: "Anything the numbers alone miss, e.g. 'matching funds required' or 'multi-year, $50k/yr for 3 years'." },
        deadline: { type: "string", description: "Next application deadline as YYYY-MM-DD. Omit if rolling or not stated — do not invent one." },
        deadline_note: { type: "string", description: "e.g. 'rolling', 'LOI due 60 days prior', 'annual cycle opens each spring'." },
        eligibility_summary: { type: "string", description: "Who may apply, in the funder's terms (501(c)(3) status, org size, sector, etc.)." },
        geographic_eligibility: { type: "string", description: "Where the applicant or the work must be located." },
        focus_areas: {
          type: "array",
          items: { type: "string", enum: [...FOCUS_AREA_TAXONOMY] },
          description: "Which of this app's canonical focus areas this grant serves. Pick only ones that genuinely apply.",
        },
        fit_score: {
          type: "number",
          description:
            "0-100: how well this fits THIS organization specifically, given its mission, size, geography, legal status, and (if given) the project brief. Be honest and use the whole range — a 45 that is clearly explained is far more useful than an inflated 85. Reserve 80+ for opportunities where the org plainly meets every stated eligibility requirement and the funder's stated priorities match its actual work.",
        },
        fit_rationale: {
          type: "string",
          description: "2-3 sentences justifying the score, referring to concrete facts about this org and this grant. No generic praise.",
        },
        concerns: {
          type: "array",
          items: { type: "string" },
          description:
            "Specific reasons this might not work out: eligibility the org may fail, a deadline that is too soon, a match requirement, an unclear or possibly stale page, an invitation-only program. Empty array only if you genuinely found none.",
        },
        evidence_confidence: {
          type: "string",
          enum: ["high", "medium", "low"],
          description:
            "'high' = you read the funder's own current program page and the details are explicit. 'medium' = funder's page but some details are vague or possibly out of date. 'low' = you could not reach the funder's own page and are relying on secondhand sources; say so in concerns too.",
        },
        already_in_database: {
          type: "boolean",
          description: "True if check_known_opportunities showed this same grant is already in the app's vetted database.",
        },
      },
      required: ["title", "funder_name", "source_url", "fit_score", "fit_rationale"],
    },
  },
];
