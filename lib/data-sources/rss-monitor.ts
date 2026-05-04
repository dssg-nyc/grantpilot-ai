import Parser from "rss-parser";

const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "GrantPilot/1.0 grant-discovery-bot" },
  customFields: { item: ["description", "summary", "content"] },
});

// Fix common malformed XML entities and attributes before parsing
function sanitizeXml(xml: string): string {
  return xml
    // Replace bare & with &amp;
    .replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[\da-fA-F]+);)/g, "&amp;")
    // Remove attributes without values (e.g. <tag selected> → <tag>)
    .replace(/<([^>]+?)(\s+[a-zA-Z][a-zA-Z0-9-_]*)(?=[\s>])/g, (_, before, attr) => {
      // If attr has no = sign, remove it
      return attr.includes("=") ? `<${before}${attr}` : `<${before}`;
    })
    // Remove CDATA sections' invalid chars
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

// Fallback: extract RSS items using regex when XML is too malformed
function extractItemsViaRegex(xml: string): Array<{ title?: string; link?: string; description?: string; pubDate?: string }> {
  const items: Array<{ title?: string; link?: string; description?: string; pubDate?: string }> = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`, "i"));
      return m ? (m[1] ?? m[2] ?? "").trim() : undefined;
    };
    const linkMatch = block.match(/<link>([^<]*)<\/link>|<link[^>]*href="([^"]*)"/) ;
    items.push({
      title: get("title"),
      link: linkMatch ? (linkMatch[1] ?? linkMatch[2]) : undefined,
      description: get("description") ?? get("summary"),
      pubDate: get("pubDate") ?? get("dc:date"),
    });
  }
  return items.slice(0, 50);
}

export interface RssGrantItem {
  title: string;
  description: string;
  link: string;
  pubDate: string | null;
  funder_name: string;
  funder_type: "foundation" | "federal_government" | "state_government" | "other";
  source_id: string;
}

// RSS_FEEDS can also be extended via RSS_FEED_URLS env var (pipe-separated: url|funder_name|funder_type)
export const RSS_FEEDS = [
  // SAMHSA Funding Opportunities
  {
    url: "https://www.samhsa.gov/grants/rss",
    funder_name: "SAMHSA",
    funder_type: "federal_government" as const,
  },
  // NIH Guide for Grants
  {
    url: "https://grants.nih.gov/feeds/rss/grants-guide-notices.xml",
    funder_name: "National Institutes of Health",
    funder_type: "federal_government" as const,
  },
  // Additional feeds can be injected via env var
  ...(process.env.RSS_FEED_URLS ?? "")
    .split("|")
    .filter(Boolean)
    .map((entry) => {
      const [url, name, type] = entry.split(",");
      return { url, funder_name: name ?? "Unknown Funder", funder_type: (type ?? "other") as "foundation" | "federal_government" | "state_government" | "other" };
    }),
];

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function fetchRssFeed(feed: typeof RSS_FEEDS[0]): Promise<RssGrantItem[]> {
  let rawXml = "";
  try {
    const resp = await fetch(feed.url, {
      headers: { "User-Agent": "GrantPilot/1.0 grant-discovery-bot" },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    rawXml = await resp.text();
  } catch (e) {
    console.error(`RSS fetch error for ${feed.url}:`, e);
    return [];
  }

  const toItems = (items: Array<{ title?: string; link?: string; description?: string; pubDate?: string; isoDate?: string; contentSnippet?: string; content?: string; guid?: string }>, feedTitle?: string): RssGrantItem[] =>
    items.map((item) => ({
      title: item.title ?? "Untitled Grant",
      description: stripTags(item.contentSnippet ?? item.content ?? item.description ?? ""),
      link: item.link ?? item.guid ?? "",
      pubDate: item.pubDate ?? item.isoDate ?? null,
      funder_name: feedTitle ?? feed.funder_name,
      funder_type: feed.funder_type,
      source_id: `rss_${Buffer.from(item.link ?? item.guid ?? item.title ?? "").toString("base64").slice(0, 32)}`,
    }));

  // Try proper XML parsing first
  try {
    const cleanXml = sanitizeXml(rawXml);
    const parsed = await parser.parseString(cleanXml);
    return toItems(parsed.items ?? [], parsed.title);
  } catch {
    // Fallback: regex-based extraction for malformed feeds
    try {
      const items = extractItemsViaRegex(rawXml);
      if (items.length > 0) return toItems(items);
    } catch (e2) {
      console.error(`RSS fallback parser failed for ${feed.url}:`, e2);
    }
    return [];
  }
}

export async function fetchAllRssFeeds(): Promise<RssGrantItem[]> {
  const results = await Promise.allSettled(RSS_FEEDS.map(fetchRssFeed));
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}
