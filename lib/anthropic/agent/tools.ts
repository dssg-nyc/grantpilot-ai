import type Anthropic from "@anthropic-ai/sdk";
import { GRANT_SECTION_KEYS } from "@/lib/utils/grant-sections";
import { FOCUS_AREA_TAXONOMY } from "@/lib/utils/taxonomy";

// Anthropic-hosted server tool: the model calls this itself and Anthropic's
// own infrastructure performs the actual web search — no external search API
// or key of our own needed. This is what lets the assistant find grants
// beyond the ~1,770 opportunities in our scraped/ingested database (federal
// grants.gov + a curated ~16-foundation list only) — most foundations,
// corporate CSR programs, and state/local grants have no scrapable API and
// are otherwise invisible to this app entirely.
const WEB_SEARCH_TOOL: Anthropic.WebSearchTool20250305 = {
  type: "web_search_20250305",
  name: "web_search",
  max_uses: 5,
};

export const AGENT_TOOLS: Anthropic.ToolUnion[] = [
  WEB_SEARCH_TOOL,
  {
    name: "search_opportunities",
    description:
      "Search the LIVE, ALREADY-VETTED grant opportunity database (federal grants.gov listings plus a curated set of foundations — about 1,770 opportunities, refreshed every few hours). Try this FIRST for any grant search — these are pre-matched against the org's profile and fastest to act on. It does NOT cover most foundations, corporate giving programs, or state/local grants — for those, or when this returns few/no good results, use web_search instead and be upfront that those are unverified leads, not vetted matches.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text search (title/topic), e.g. 'youth mental health'. Optional." },
        focus_areas: {
          type: "array",
          items: { type: "string", enum: [...FOCUS_AREA_TAXONOMY] },
          description: "Filter to one or more focus areas from the canonical taxonomy. Optional.",
        },
        funder_type: {
          type: "string",
          enum: ["federal_government", "state_government", "foundation", "corporate", "international"],
          description: "Filter to one funder type. Optional.",
        },
        min_amount: { type: "number", description: "Minimum award amount. Optional." },
        max_amount: { type: "number", description: "Maximum award amount. Optional." },
        limit: { type: "number", description: "Max results, default 8, max 20." },
      },
    },
  },
  {
    name: "get_opportunity_detail",
    description:
      "Fetch full details for one specific grant opportunity by id, including this org's match score and match reasoning if it's already been scored. Use before drafting anything about a specific grant.",
    input_schema: {
      type: "object",
      properties: {
        opportunity_id: { type: "string" },
      },
      required: ["opportunity_id"],
    },
  },
  {
    name: "get_matches",
    description:
      "Get this organization's current AI-scored grant matches, best first, with the reasoning behind each score. Use when the user asks what they're matched to, or what to prioritize.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max results, default 10." },
      },
    },
  },
  {
    name: "get_pipeline",
    description:
      "List this organization's grant pipeline items (grants they've saved or are actively working on), with stage and deadline.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "add_to_pipeline",
    description:
      "Add a grant opportunity to the organization's pipeline so they can track and draft it. Only call this after the user has confirmed they want to pursue a specific opportunity — don't add things speculatively.",
    input_schema: {
      type: "object",
      properties: {
        opportunity_id: { type: "string" },
        notes: { type: "string", description: "Optional short note on why this was added." },
      },
      required: ["opportunity_id"],
    },
  },
  {
    name: "update_pipeline_stage",
    description: "Move a pipeline item to a different stage.",
    input_schema: {
      type: "object",
      properties: {
        pipeline_item_id: { type: "string" },
        stage: {
          type: "string",
          enum: ["saved", "researching", "drafting", "submitted", "awarded", "rejected", "withdrawn"],
        },
      },
      required: ["pipeline_item_id", "stage"],
    },
  },
  {
    name: "get_draft",
    description:
      "Get the current state of a grant application draft for a pipeline item — every section that exists so far and its content. Always call this before writing or revising a section, so you know what's already there and don't duplicate or contradict it.",
    input_schema: {
      type: "object",
      properties: {
        pipeline_item_id: { type: "string" },
      },
      required: ["pipeline_item_id"],
    },
  },
  {
    name: "write_draft_section",
    description:
      "Write or revise ONE section of a grant application draft, persisting it for the user. This is how you actually help someone get a grant draft ready — call it with real, complete, well-written section content (not a placeholder or outline) grounded strictly in the organization's real profile data and the opportunity's real requirements, both already available to you in context. If information needed for a strong section is missing from what you know about the org, say so to the user in your reply and write the section in general terms rather than inventing specifics (no fabricated statistics, named partners, or past outcomes that weren't given to you). Call this once per section you're producing or revising — for a full application, call it multiple times across the conversation.",
    input_schema: {
      type: "object",
      properties: {
        pipeline_item_id: { type: "string" },
        section_key: { type: "string", enum: [...GRANT_SECTION_KEYS] },
        content: { type: "string", description: "The full section text, ready for the user to review. Plain prose, no markdown headers (the UI already labels the section)." },
      },
      required: ["pipeline_item_id", "section_key", "content"],
    },
  },
  {
    name: "import_web_opportunity",
    description:
      "Bring a grant found via web_search into the real system: scrapes the page, AI-extracts structured details, and adds it as a real, searchable, matchable opportunity in the org's pipeline — the same pipeline every other opportunity in this app goes through, not a chat-only summary. Only call this after the user has confirmed they want to track a SPECIFIC grant you found via web_search — never call it speculatively for every search result. Requires a direct URL to the actual grant/funding-opportunity page (not a search results page or a funder's generic homepage). This can take up to ~20 seconds and may fail if the page can't be scraped or doesn't contain enough detail — if it fails, tell the user and suggest they add it manually via the opportunity URL in the Opportunities tab instead.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Direct URL to the grant/opportunity page found via web_search." },
        funder_name: { type: "string", description: "The funding organization's name." },
        funder_type: {
          type: "string",
          enum: ["federal_government", "state_government", "foundation", "corporate", "international", "other"],
        },
      },
      required: ["url", "funder_name"],
    },
  },
];
