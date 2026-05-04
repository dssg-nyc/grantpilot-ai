import { crawlGrantPage } from "@/lib/firecrawl/client";
import { extractOpportunitiesFromMarkdown, type ExtractedGrant } from "./grant-page-parser";

export interface FoundationTarget {
  name: string;
  url: string;
  funder_type: "foundation" | "corporate";
}

export const FOUNDATION_TARGETS: FoundationTarget[] = [
  { name: "Ford Foundation", url: "https://www.fordfoundation.org/work/our-grants/", funder_type: "foundation" },
  { name: "MacArthur Foundation", url: "https://www.macfound.org/grants/", funder_type: "foundation" },
  { name: "Robert Wood Johnson Foundation", url: "https://www.rwjf.org/en/grants/funding-opportunities.html", funder_type: "foundation" },
  { name: "W.K. Kellogg Foundation", url: "https://www.wkkf.org/grants", funder_type: "foundation" },
  { name: "Annie E. Casey Foundation", url: "https://www.aecf.org/work/grant-making", funder_type: "foundation" },
  { name: "Google.org", url: "https://www.google.org/our-work/", funder_type: "corporate" },
  { name: "Salesforce.org", url: "https://www.salesforce.org/grants/", funder_type: "corporate" },
  { name: "Microsoft Philanthropies", url: "https://www.microsoft.com/en-us/corporate-responsibility/philanthropies", funder_type: "corporate" },
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
