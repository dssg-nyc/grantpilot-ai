import { crawlGrantPage } from "@/lib/firecrawl/client";
import { extractOpportunitiesFromMarkdown, type ExtractedGrant } from "./grant-page-parser";

export interface FoundationTarget {
  name: string;
  url: string;
  funder_type: "foundation" | "corporate";
}

// NOTE: Foundations rarely expose a clean grants API and pages rot often.
// These URLs were verified (2026-06) to return readable grant/program content
// that the AI extractor can parse. Re-verify periodically — foundation sites
// change URLs and frequently render listings via JS.
export const FOUNDATION_TARGETS: FoundationTarget[] = [
  // Foundations — verified (2026-06) to return extractable grant/program content.
  { name: "Hewlett Foundation", url: "https://hewlett.org/grants/", funder_type: "foundation" },
  { name: "Mellon Foundation", url: "https://www.mellon.org/grant-programs", funder_type: "foundation" },
  { name: "Global Grand Challenges (Gates)", url: "https://gcgh.grandchallenges.org/challenges", funder_type: "foundation" },
  { name: "Wellcome Trust", url: "https://wellcome.org/grant-funding/schemes", funder_type: "foundation" },
  { name: "Kresge Foundation", url: "https://kresge.org/grants-social-investments/current-funding-opportunities/", funder_type: "foundation" },
  { name: "Commonwealth Fund", url: "https://www.commonwealthfund.org/grants-fellowships", funder_type: "foundation" },
  { name: "Open Philanthropy", url: "https://www.openphilanthropy.org/request-for-proposals/", funder_type: "foundation" },
  { name: "Henry Luce Foundation", url: "https://hluce.org/programs/", funder_type: "foundation" },
  { name: "Spencer Foundation", url: "https://www.spencer.org/grant_types", funder_type: "foundation" },
  { name: "McKnight Foundation", url: "https://www.mcknight.org/programs/", funder_type: "foundation" },
  { name: "Surdna Foundation", url: "https://www.surdna.org/grants/", funder_type: "foundation" },
  { name: "Rockefeller Foundation", url: "https://www.rockefellerfoundation.org/grants/", funder_type: "foundation" },
  // Corporate / CSR funders.
  { name: "Mozilla Foundation", url: "https://foundation.mozilla.org/en/what-we-fund/awards/", funder_type: "corporate" },
  { name: "AWS IMAGINE Grant", url: "https://aws.amazon.com/government-education/nonprofits/aws-imagine-grant/", funder_type: "corporate" },
  { name: "Walmart Foundation", url: "https://walmart.org/how-we-give/", funder_type: "corporate" },
  { name: "T-Mobile Hometown Grants", url: "https://www.t-mobile.com/coverage/hometown-grants", funder_type: "corporate" },
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
