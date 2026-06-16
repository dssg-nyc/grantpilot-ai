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
