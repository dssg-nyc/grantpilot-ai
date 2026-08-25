import { NextResponse } from "next/server";
import { anthropic } from "@/lib/anthropic/client";
import { crawlOrgSite } from "@/lib/firecrawl/client";
import { WEBSITE_PROFILE_SCHEMA, websiteProfilePrompt } from "@/lib/anthropic/prompts/website-profile-extraction";
import { rateLimitGuard, strictRateLimiter } from "@/lib/redis/rate-limiter";
import { FOCUS_AREA_TAXONOMY } from "@/lib/utils/taxonomy";
import type { OrgProfile, OrgType } from "@/types/profile";

/** Several Firecrawl scrapes plus one extraction call. */
export const maxDuration = 120;

const FOCUS_SET = new Set<string>(FOCUS_AREA_TAXONOMY);
const ORG_TYPES = new Set<OrgType>(["ngo", "community_group", "educational", "individual", "impact_startup", "other"]);
const GEO_AREAS = new Set(["national", "multi_state", "state", "regional", "local"]);
const BUDGETS = new Set(["<50k", "50k_250k", "250k_1m", "1m_5m", "5m_plus"]);

interface Extracted {
  legal_name: string;
  dba_name: string;
  mission_statement: string;
  org_type: string;
  primary_focus_areas: string[];
  secondary_focus_areas: string[];
  target_beneficiaries: string[];
  geographic_service_area: string;
  service_states: string[];
  service_cities: string[];
  year_founded: number;
  is_501c3: string;
  ein: string;
  annual_budget_range: string;
  staff_full_time: number;
  staff_part_time: number;
  programs: { name: string; description: string }[];
  not_found: string[];
  confidence: number;
}

/**
 * Turns the model's extraction into a Partial<OrgProfile> the onboarding
 * wizard can merge straight into its form state.
 *
 * Only fields the site actually supported are included — an empty value is
 * omitted entirely rather than written as "" or 0, so autofill never
 * overwrites something the user already typed with a blank.
 */
function toProfile(e: Extracted): Partial<OrgProfile> {
  const out: Partial<OrgProfile> = {};

  if (e.legal_name?.trim()) out.legal_name = e.legal_name.trim().slice(0, 300);
  if (e.dba_name?.trim()) out.dba_name = e.dba_name.trim().slice(0, 300);
  if (e.mission_statement?.trim()) out.mission_statement = e.mission_statement.trim().slice(0, 4000);
  if (ORG_TYPES.has(e.org_type as OrgType)) out.org_type = e.org_type as OrgType;

  const primary = (e.primary_focus_areas ?? []).filter((a) => FOCUS_SET.has(a)).slice(0, 3);
  if (primary.length) out.primary_focus_areas = primary;

  const secondary = (e.secondary_focus_areas ?? [])
    .filter((a) => FOCUS_SET.has(a) && !primary.includes(a))
    .slice(0, 3);
  if (secondary.length) out.secondary_focus_areas = secondary;

  const beneficiaries = (e.target_beneficiaries ?? [])
    .filter((b) => typeof b === "string" && b.trim())
    .map((b) => b.trim().slice(0, 120))
    .slice(0, 6);
  if (beneficiaries.length) out.target_beneficiaries = beneficiaries;

  if (GEO_AREAS.has(e.geographic_service_area)) {
    out.geographic_service_area = e.geographic_service_area as OrgProfile["geographic_service_area"];
  }

  const states = (e.service_states ?? [])
    .map((s) => String(s).trim().toUpperCase())
    .filter((s) => /^[A-Z]{2}$/.test(s))
    .slice(0, 12);
  if (states.length) out.service_states = states;

  const cities = (e.service_cities ?? [])
    .filter((c) => typeof c === "string" && c.trim())
    .map((c) => c.trim().slice(0, 100))
    .slice(0, 12);
  if (cities.length) out.service_cities = cities;

  const year = Number(e.year_founded);
  const currentYear = new Date().getFullYear();
  if (Number.isInteger(year) && year >= 1800 && year <= currentYear) {
    out.year_founded = year;
    out.years_in_operation = currentYear - year;
  }

  // Only a positive claim is carried across. "unknown" must stay unset rather
  // than becoming false, because false is itself a meaningful eligibility
  // signal the matcher acts on.
  if (e.is_501c3 === "yes") out.is_501c3 = true;
  else if (e.is_501c3 === "no") out.is_501c3 = false;

  if (/^\d{2}-?\d{7}$/.test((e.ein ?? "").trim())) out.ein = e.ein.trim();
  if (BUDGETS.has(e.annual_budget_range)) {
    out.annual_budget_range = e.annual_budget_range as OrgProfile["annual_budget_range"];
  }

  if (Number.isInteger(e.staff_full_time) && e.staff_full_time > 0) out.staff_full_time = e.staff_full_time;
  if (Number.isInteger(e.staff_part_time) && e.staff_part_time > 0) out.staff_part_time = e.staff_part_time;

  const programs = (e.programs ?? [])
    .filter((p) => p && typeof p.name === "string" && p.name.trim())
    .map((p) => ({ name: p.name.trim().slice(0, 200), description: (p.description ?? "").trim().slice(0, 1000) }))
    .slice(0, 8);
  if (programs.length) out.programs = programs;

  return out;
}

export async function POST(request: Request) {
  const limited = await rateLimitGuard(request, "profile-from-website", strictRateLimiter);
  if (limited) return limited;

  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = (body.url ?? "").trim();
  if (!raw) return NextResponse.json({ error: "Enter your organization's website address." }, { status: 400 });

  // Accept "example.org" as readily as a full URL — people paste what's on
  // their business card, not what a URL parser wants.
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return NextResponse.json({ error: "That doesn't look like a valid website address." }, { status: 400 });
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return NextResponse.json({ error: "Only http and https addresses are supported." }, { status: 400 });
  }

  let pages: { url: string; markdown: string }[];
  try {
    pages = await crawlOrgSite(url.toString());
  } catch (err) {
    console.error("from-website: crawl failed", err);
    return NextResponse.json(
      { error: "Couldn't reach that website. Check the address, or fill the form in manually." },
      { status: 502 },
    );
  }

  // Judge the corpus as a whole, not page count. A JavaScript-rendered site
  // can return one thin shell that technically parses but says nothing — and
  // extracting from that yields a profile assembled out of navigation labels,
  // which is worse than no autofill at all because the user may trust it.
  const totalChars = pages.reduce((sum, p) => sum + p.markdown.trim().length, 0);
  if (pages.length === 0 || totalChars < 1200) {
    return NextResponse.json(
      {
        // Deliberately does not assert a cause: a dead domain, a blocked
        // crawler, and a JavaScript-only site all land here, and guessing
        // wrong sends the user off debugging the wrong thing.
        error:
          "Couldn't get enough readable text from that address. Double-check it, or fill the form in manually — pasting your mission into the Mission step will still pick up your focus areas.",
      },
      { status: 422 },
    );
  }

  let extracted: Extracted;
  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 8000,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: WEBSITE_PROFILE_SCHEMA },
      },
      messages: [{ role: "user", content: websiteProfilePrompt(url.toString(), pages) }],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "Couldn't process that site automatically. Please fill the form in manually." },
        { status: 422 },
      );
    }

    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") throw new Error("No text block in response");
    extracted = JSON.parse(text.text) as Extracted;
  } catch (err) {
    console.error("from-website: extraction failed", err);
    return NextResponse.json(
      { error: "Couldn't read enough from that site to fill the form. Please continue manually." },
      { status: 502 },
    );
  }

  const suggestions = toProfile(extracted);

  return NextResponse.json({
    suggestions,
    website_url: url.toString(),
    filled_fields: Object.keys(suggestions),
    not_found: Array.isArray(extracted.not_found) ? extracted.not_found.slice(0, 20) : [],
    confidence: typeof extracted.confidence === "number" ? Math.max(0, Math.min(1, extracted.confidence)) : 0.5,
    sources: pages.map((p) => p.url),
  });
}
