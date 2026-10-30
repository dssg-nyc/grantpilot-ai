import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import * as cheerio from "cheerio";
import type { CheerioAPI, Cheerio } from "cheerio";
import type { AnyNode, Element } from "domhandler";
import TurndownService from "turndown";

/**
 * Self-hosted replacement for Firecrawl: plain fetch + cheerio + turndown.
 *
 * There is no headless browser, so JS-rendered pages come back thinner than
 * they did through Firecrawl. To compensate, pages whose visible text is thin
 * also get their JSON-LD, meta/OpenGraph descriptions and <noscript> content
 * appended — that is often where SPA-built nonprofit sites keep the only
 * server-rendered copy of their mission and contact facts.
 */

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 20_000;
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 5;
// Below this many characters of extracted body markdown we treat the page as
// a JS shell and append the structured-data fallbacks.
const THIN_CONTENT_CHARS = 600;

// ── SSRF guard ──────────────────────────────────────────────────────────────
// Firecrawl fetched from its own infrastructure; now the VPS fetches user-
// supplied URLs itself, next to Postgres, Kong, Ollama and the cloud metadata
// endpoint. Every hop (including redirects) must resolve to a public address.
const PRIVATE_RANGES = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16],
  ["198.18.0.0", 15], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) {
  PRIVATE_RANGES.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
] as const) {
  PRIVATE_RANGES.addSubnet(net, prefix, "ipv6");
}

function isPrivateAddress(address: string): boolean {
  // IPv4-mapped IPv6 (::ffff:10.0.0.1) must be checked as the IPv4 it wraps.
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return PRIVATE_RANGES.check(mapped[1], "ipv4");
  const family = isIP(address);
  if (family === 4) return PRIVATE_RANGES.check(address, "ipv4");
  if (family === 6) return PRIVATE_RANGES.check(address, "ipv6");
  return true;
}

async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Unsupported protocol: ${url.protocol}`);
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new Error(`Refusing to fetch non-public address: ${url.hostname}`);
  }
}

// ── Fetching ────────────────────────────────────────────────────────────────

async function readCapped(res: Response): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  // Oversized pages are truncated, not rejected — the head of the document is
  // where the content we want lives, and cheerio tolerates unclosed tags.
  await reader.cancel().catch(() => {});
  const out = new Uint8Array(Math.min(total, MAX_BYTES));
  let offset = 0;
  for (const chunk of chunks) {
    const slice = chunk.subarray(0, out.length - offset);
    out.set(slice, offset);
    offset += slice.byteLength;
    if (offset >= out.length) break;
  }
  return out;
}

function decode(bytes: Uint8Array, contentType: string): string {
  const charset = contentType.match(/charset=["']?([\w-]+)/i)?.[1] ?? "utf-8";
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

/** Fetches an HTML page, following redirects manually so each hop is SSRF-checked. */
async function fetchHtml(rawUrl: string): Promise<{ html: string; finalUrl: string }> {
  let url = new URL(rawUrl);
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      await res.body?.cancel().catch(() => {});
      url = new URL(res.headers.get("location")!, url);
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      throw new Error(`HTTP ${res.status} fetching ${url.href}`);
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      await res.body?.cancel().catch(() => {});
      throw new Error(`Unsupported content-type "${contentType}" at ${url.href}`);
    }
    return { html: decode(await readCapped(res), contentType), finalUrl: url.href };
  }
  throw new Error(`Too many redirects fetching ${rawUrl}`);
}

// ── HTML → markdown ─────────────────────────────────────────────────────────

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "*",
});
// Images and media cost tokens and the extractor never uses them. This has to
// be a rule rather than turndown.remove(), because built-in rules (including
// the image rule) take precedence over the remove list.
const MEDIA_TAGS = new Set(["IMG", "PICTURE", "SVG", "VIDEO", "AUDIO", "CANVAS", "IFRAME"]);
turndown.addRule("dropMedia", {
  filter: (node) => MEDIA_TAGS.has(node.nodeName.toUpperCase()),
  replacement: () => "",
});
// Anchors with no text (icon links) become noise like "[](https://…)".
turndown.addRule("dropEmptyLinks", {
  filter: (node) => node.nodeName === "A" && !(node.textContent ?? "").trim(),
  replacement: () => "",
});

const NOISE_SELECTORS = [
  "script", "style", "noscript", "template", "link", "meta",
  "nav", "aside", "dialog", "[role=navigation]", "[role=banner]", "[role=contentinfo]",
  "[role=dialog]", "[aria-modal=true]", "[hidden]",
  // Cookie/consent banners from the common CMPs.
  "#onetrust-consent-sdk", "#CybotCookiebotDialog", ".cc-window", "#cookie-law-info-bar",
  ".skip-link", ".screen-reader-text", ".sr-only", ".visually-hidden",
].join(",");

// Generic cookie/consent naming. Matched loosely, so only small elements are
// removed — some themes put "cookie-banner-open" on the page wrapper itself.
const CONSENT_SELECTORS = "[id*=cookie i],[class*=cookie i],[id*=consent i],[class*=consent i],[class*=gdpr i]";

function textLen($el: Cheerio<AnyNode>): number {
  return $el.text().replace(/\s+/g, " ").trim().length;
}

function stripNoise($: CheerioAPI): void {
  $(NOISE_SELECTORS).not("html, body").remove();
  $(CONSENT_SELECTORS)
    .not("html, body")
    .filter((_, el) => textLen($(el)) < 1500)
    .remove();
  // Site-level header/footer only — <header> inside an <article> usually holds
  // the page title, which we want to keep.
  $("header, footer").filter((_, el) => $(el).parents("article, main, [role=main]").length === 0).remove();
  // Newsletter/search/donate forms are noise, but ASP.NET and some CMSes wrap
  // the entire page in one <form>; unwrap rather than delete those.
  $("form").each((_, el) => {
    const $el = $(el);
    if (textLen($el) < 500) $el.remove();
    else $el.replaceWith($el.contents());
  });
}

const LAYOUT_TAGS = new Set(["div", "section", "main", "article", "span"]);

/**
 * Picks the main content root: a semantic container when one holds a
 * meaningful share of the page text, otherwise descend from <body> through
 * wrapper divs while a single child carries nearly all of the text.
 */
function pickContentRoot($: CheerioAPI): Cheerio<Element> {
  const body = $("body").length ? $("body") : $.root().children().first();
  const bodyLen = textLen(body) || 1;

  for (const sel of ["main", "[role=main]", "article", "#content", "#main-content", ".main-content"]) {
    const matches = $(sel);
    if (matches.length === 0) continue;
    // Several <article>s are a listing (e.g. a grants index) — keep them all
    // by using their common container instead of the first card.
    const candidate = matches.length === 1 ? matches.first() : null;
    if (candidate && textLen(candidate) >= Math.max(200, bodyLen * 0.25)) {
      return candidate as Cheerio<Element>;
    }
  }

  // Only descend into layout containers, and never past a sibling heading:
  // an <h1> next to one big text block is the page title, not chrome.
  let current = body as Cheerio<Element>;
  for (;;) {
    const total = textLen(current);
    const children = current.children().toArray();
    const best = children
      .map((c) => ({ el: c, len: textLen($(c)) }))
      .sort((a, b) => b.len - a.len)[0];
    if (!best || total === 0 || best.len < total * 0.85) break;
    if (!LAYOUT_TAGS.has(best.el.tagName.toLowerCase())) break;
    const siblingHasHeading = children.some(
      (c) => c !== best.el && ($(c).is("h1,h2,h3") || $(c).find("h1,h2,h3").length > 0),
    );
    if (siblingHasHeading) break;
    current = $(best.el);
  }
  return current;
}

function absolutizeLinks($: CheerioAPI, baseUrl: string): void {
  const base = $("base[href]").attr("href");
  let resolvedBase = baseUrl;
  try {
    if (base) resolvedBase = new URL(base, baseUrl).href;
  } catch {
    /* malformed <base>; fall back to the page URL */
  }
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")!.trim();
    if (/^(javascript:|#)/i.test(href) || !href) {
      $(el).removeAttr("href");
      return;
    }
    try {
      $(el).attr("href", new URL(href, resolvedBase).href);
    } catch {
      $(el).removeAttr("href");
    }
  });
}

/** Flattens JSON-LD into "key: value" lines, keeping only human-readable strings. */
function flattenJsonLd(node: unknown, out: string[], depth = 0): void {
  if (depth > 6 || out.length > 80 || node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) flattenJsonLd(item, out, depth + 1);
    return;
  }
  if (typeof node !== "object") return;
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === "@context" || key === "@id") continue;
    if (typeof value === "string" || typeof value === "number") {
      const str = String(value).trim();
      // Skip bare URLs and IDs; descriptive text is what the extractor needs.
      if (str && !/^https?:\/\/\S+$/.test(str) && str.length < 2000) {
        out.push(`- ${key.replace(/^@/, "")}: ${str}`);
      }
    } else {
      flattenJsonLd(value, out, depth + 1);
    }
  }
}

/** Collects metadata that survives on JS-rendered pages. Must run before stripNoise. */
function collectFallbacks($: CheerioAPI): string {
  const sections: string[] = [];

  const meta = (sel: string) => $(sel).attr("content")?.trim() ?? "";
  const metaLines = [
    ["Title", $("title").first().text().trim()],
    ["Site name", meta('meta[property="og:site_name"]')],
    ["OpenGraph title", meta('meta[property="og:title"]')],
    ["Description", meta('meta[name="description"]')],
    ["OpenGraph description", meta('meta[property="og:description"]')],
    ["Twitter description", meta('meta[name="twitter:description"]')],
  ];
  const seen = new Set<string>();
  const metaOut: string[] = [];
  for (const [label, value] of metaLines) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    metaOut.push(`- ${label}: ${value}`);
  }
  if (metaOut.length) sections.push(`## Page metadata\n\n${metaOut.join("\n")}`);

  const ldOut: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      flattenJsonLd(JSON.parse($(el).text()), ldOut);
    } catch {
      /* invalid JSON-LD is common; ignore */
    }
  });
  if (ldOut.length) sections.push(`## Structured data\n\n${[...new Set(ldOut)].join("\n")}`);

  // <noscript> children are parsed as raw text by htmlparser2, so re-parse.
  const noscript = $("noscript")
    .toArray()
    .map((el) => $(el).text())
    .join("\n");
  if (noscript.trim()) {
    const $ns = cheerio.load(noscript);
    $ns("script, style, img, iframe").remove();
    const md = turndown.turndown($ns("body").html() ?? "").trim();
    if (md.length > 40) sections.push(`## Noscript content\n\n${md}`);
  }

  return sections.join("\n\n");
}

function tidyMarkdown(md: string): string {
  return md
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Converts a fetched HTML document to main-content markdown. Exported for tests. */
export function htmlToMarkdown(html: string, pageUrl: string): string {
  const $ = cheerio.load(html);
  const fallbacks = collectFallbacks($);

  stripNoise($);
  absolutizeLinks($, pageUrl);
  const root = pickContentRoot($);
  const body = tidyMarkdown(turndown.turndown($.html(root) || ""));

  if (body.length >= THIN_CONTENT_CHARS || !fallbacks) return body;
  return tidyMarkdown([body, fallbacks].filter(Boolean).join("\n\n"));
}

/** Fetches a URL and returns its main content as markdown. Throws on network/HTTP errors. */
export async function fetchPageMarkdown(url: string): Promise<{ url: string; markdown: string }> {
  const { html, finalUrl } = await fetchHtml(url);
  return { url: finalUrl, markdown: htmlToMarkdown(html, finalUrl) };
}

export async function crawlGrantPage(url: string): Promise<string> {
  const { markdown } = await fetchPageMarkdown(url);
  return markdown;
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
      const page = await fetchPageMarkdown(target);
      // A nav-only shell or soft-404 still clears a few hundred characters of
      // menu links, and feeding those to the model produces a confident-
      // looking profile built from navigation labels. Require enough text to
      // plausibly contain prose.
      return page.markdown.trim().length > 600 ? { target, ...page } : null;
    } catch {
      return null;
    }
  });

  const settled = await Promise.all(attempts);
  const pages = settled.filter((p): p is { target: string; url: string; markdown: string } => p !== null);

  // De-duplicate: /about and /about-us are frequently the same page, and
  // missing paths often redirect back to the homepage.
  const seen = new Set<string>();
  const unique: { url: string; markdown: string }[] = [];
  for (const page of pages) {
    const fingerprint = page.markdown.slice(0, 400);
    if (seen.has(fingerprint) || seen.has(page.url)) continue;
    seen.add(fingerprint);
    seen.add(page.url);
    unique.push({ url: page.target, markdown: page.markdown });
    if (unique.length >= maxPages) break;
  }

  return unique;
}
