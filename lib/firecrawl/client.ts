import { FirecrawlClient } from "@mendable/firecrawl-js";

const firecrawl = new FirecrawlClient({ apiKey: process.env.FIRECRAWL_API_KEY });

export async function crawlGrantPage(url: string): Promise<string> {
  const result = await firecrawl.scrape(url, {
    formats: ["markdown"],
    onlyMainContent: true,
    timeout: 30000,
  });

  return result.markdown ?? "";
}
