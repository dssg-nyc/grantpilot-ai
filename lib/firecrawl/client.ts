import { FirecrawlClient } from "@mendable/firecrawl-js";

const firecrawl = new FirecrawlClient({ apiKey: process.env.FIRECRAWL_API_KEY });

export async function crawlGrantPage(url: string): Promise<string> {
  const result = await firecrawl.scrape(url, {
    formats: ["markdown"],
    onlyMainContent: true,
    waitFor: 3000, // many foundation listings render their grants via JS
    timeout: 45000,
  });

  return result.markdown ?? "";
}

/**
 * Scrapes an organization's homepage plus the handful of pages that actually
 * carry profile facts (mission, history, staff, financials). Nonprofit sites
 * put the useful material on /about far more often than the homepage, which
 * is usually a donate banner and a hero image.
 *
 * Best-effort by design: every candidate path is tried concurrently and
 * failures are dropped silently, because a 404 on /impact is the normal case,
 * not an error worth failing the whole import over.
 */
const PROFILE_PATHS = ["", "/about", "/about-us", "/our-mission", "/who-we-are", "/programs", "/impact"];

export async function crawlOrgSite(
  baseUrl: string,
  maxPages = 4,
): Promise<{ url: string; markdown: string }[]> {
  const origin = new URL(baseUrl).origin;

  const attempts = PROFILE_PATHS.map(async (path) => {
    const target = path ? `${origin}${path}` : baseUrl;
    try {
      const result = await firecrawl.scrape(target, {
        formats: ["markdown"],
        onlyMainContent: true,
        // Nonprofit marketing sites are frequently JS-rendered single-page
        // apps that return an empty shell if you read them too early. Four
        // seconds is what it takes for those to paint their actual copy.
        waitFor: 4000,
        timeout: 45000,
      });
      const markdown = result.markdown ?? "";
      // A nav-only shell or soft-404 still clears a few hundred characters of
      // menu links, and feeding those to the model produces a confident-
      // looking profile built from navigation labels. Require enough text to
      // plausibly contain prose.
      return markdown.trim().length > 600 ? { url: target, markdown } : null;
    } catch {
      return null;
    }
  });

  const settled = await Promise.all(attempts);
  const pages = settled.filter((p): p is { url: string; markdown: string } => p !== null);

  // De-duplicate: /about and /about-us are frequently the same page.
  const seen = new Set<string>();
  const unique: { url: string; markdown: string }[] = [];
  for (const page of pages) {
    const fingerprint = page.markdown.slice(0, 400);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    unique.push(page);
    if (unique.length >= maxPages) break;
  }

  return unique;
}
