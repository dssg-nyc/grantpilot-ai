import { crawlGrantPage } from "@/lib/scraper/client";
import { extractOpportunitiesFromMarkdown, type ExtractedGrant } from "./grant-page-parser";

export interface FoundationTarget {
  name: string;
  url: string;
  funder_type: "foundation" | "corporate";
}

// NOTE: Foundations rarely expose a clean grants API and pages rot often.
// These URLs were re-verified (2026-10) against the plain-fetch scraper in
// ./client (no headless browser) to return server-rendered grant/program
// content the AI extractor can parse. Re-verify periodically — foundation
// sites change URLs, and a page that only renders its listing via JS will
// come back as little more than its meta description.
export const FOUNDATION_TARGETS: FoundationTarget[] = [
  // Foundations.
  { name: "Hewlett Foundation", url: "https://hewlett.org/grants/", funder_type: "foundation" },
  { name: "Mellon Foundation", url: "https://www.mellon.org/grant-programs", funder_type: "foundation" },
  { name: "Global Grand Challenges (Gates)", url: "https://gcgh.grandchallenges.org/challenges", funder_type: "foundation" },
  { name: "Wellcome Trust", url: "https://wellcome.org/grant-funding/schemes", funder_type: "foundation" },
  { name: "Kresge Foundation", url: "https://kresge.org/grants-social-investments/current-funding-opportunities/", funder_type: "foundation" },
  { name: "Henry Luce Foundation", url: "https://hluce.org/programs/", funder_type: "foundation" },
  { name: "McKnight Foundation", url: "https://www.mcknight.org/programs/", funder_type: "foundation" },
  { name: "Surdna Foundation", url: "https://www.surdna.org/grants/", funder_type: "foundation" },
  { name: "Rockefeller Foundation", url: "https://www.rockefellerfoundation.org/grants/", funder_type: "foundation" },
  // Corporate / CSR funders.
  { name: "Walmart Foundation", url: "https://walmart.org/how-we-give/", funder_type: "corporate" },
  // Dropped 2026-10 when Firecrawl was replaced:
  //   404 (URL rotted): Spencer /grant_types, AWS IMAGINE Grant, T-Mobile Hometown Grants.
  //   403 to non-browser clients (bot protection): Commonwealth Fund,
  //   Open Philanthropy (now redirects to coefficientgiving.org), Mozilla Foundation.
  // Re-add with a fresh URL only after checking it returns HTML to a plain fetch.
];

export interface ScrapedGrant extends ExtractedGrant {
  funder_name: string;
  funder_type: "foundation" | "corporate";
  source_url: string;
}

export async function scrapeFoundation(target: FoundationTarget): Promise<ScrapedGrant[]> {
  try {
    const markdown = await crawlGrantPage(target.url);
    if (!markdown) return [];
    const grants = await extractOpportunitiesFromMarkdown(markdown, target.name);
    return grants.map((g) => ({
      ...g,
      funder_name: target.name,
      funder_type: target.funder_type,
      source_url: target.url,
    }));
  } catch (e) {
    console.error(`Foundation scraper error for ${target.name}:`, e);
    return [];
  }
}

export async function scrapeAllFoundations(): Promise<ScrapedGrant[]> {
  const results: ScrapedGrant[] = [];
  for (const target of FOUNDATION_TARGETS) {
    const grants = await scrapeFoundation(target);
    results.push(...grants);
    // Respect rate limits between scrapes
    await new Promise((r) => setTimeout(r, 2000));
  }
  return results;
}
