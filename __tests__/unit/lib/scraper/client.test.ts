// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { crawlGrantPage, crawlOrgSite, fetchPageMarkdown, htmlToMarkdown } from "@/lib/scraper/client";

const PROSE = "We fund community health programs across the Midwest. ".repeat(20);

function htmlResponse(body: string, init: ResponseInit = {}): Response {
  return new Response(body, {
    status: 200,
    ...init,
    headers: { "content-type": "text/html; charset=utf-8", ...(init.headers ?? {}) },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("htmlToMarkdown", () => {
  it("keeps main content and drops site chrome, banners and media", () => {
    const html = `<html><body>
      <header><a href="/">Logo</a><nav><a href="/a">Menu A</a></nav></header>
      <div id="onetrust-consent-sdk">We use cookies. Accept all</div>
      <div class="cookie-notice">Cookie settings</div>
      <main><h1>Grants</h1><p>${PROSE}</p>
        <img src="/hero.png" alt="hero"><a href="/apply">Apply now</a><a href="/x"><svg></svg></a>
        <form><input name="email"><button>Subscribe</button></form>
      </main>
      <footer>Copyright Foundation</footer>
      <script>window.x = 1</script>
    </body></html>`;
    const md = htmlToMarkdown(html, "https://example.org/grants/");
    expect(md).toContain("# Grants");
    expect(md).toContain("[Apply now](https://example.org/apply)");
    expect(md).not.toMatch(/Menu A|Logo|cookies|Cookie settings|Copyright|Subscribe|window\.x|hero|\[\]\(/);
  });

  it("unwraps a page-wide ASP.NET form instead of deleting the content", () => {
    const html = `<body><form id="aspnetForm"><div><h2>Program</h2><p>${PROSE}</p></div></form></body>`;
    const md = htmlToMarkdown(html, "https://example.org/");
    expect(md).toContain("## Program");
    expect(md).toContain("community health programs");
  });

  it("respects <base href> when absolutizing links", () => {
    const html = `<head><base href="https://cdn.example.org/site/"></head><body><p>${PROSE}<a href="rfp.html">RFP</a></p></body>`;
    expect(htmlToMarkdown(html, "https://example.org/")).toContain("(https://cdn.example.org/site/rfp.html)");
  });

  it("falls back to meta, JSON-LD and noscript content on JS-rendered shells", () => {
    const html = `<html><head>
      <title>Helping Hands</title>
      <meta name="description" content="Helping Hands feeds 5,000 families in Ohio each year.">
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"NGO","name":"Helping Hands Inc","foundingDate":"1998","url":"https://hh.org"}</script>
      </head><body><div id="root"></div><noscript><p>Our mission is to end food insecurity in Ohio.</p></noscript></body></html>`;
    const md = htmlToMarkdown(html, "https://hh.org/");
    expect(md).toContain("Description: Helping Hands feeds 5,000 families");
    expect(md).toContain("name: Helping Hands Inc");
    expect(md).toContain("foundingDate: 1998");
    expect(md).not.toContain("https://hh.org\n");
    expect(md).toContain("Our mission is to end food insecurity in Ohio.");
  });

  it("does not append fallbacks when the page already has enough prose", () => {
    const html = `<head><meta name="description" content="META ONLY"></head><body><main><p>${PROSE}</p></main></body>`;
    expect(htmlToMarkdown(html, "https://example.org/")).not.toContain("META ONLY");
  });
});

describe("fetchPageMarkdown", () => {
  it("refuses private and loopback addresses", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const url of ["http://127.0.0.1:11434/", "http://10.0.0.5/", "http://169.254.169.254/", "http://[::1]/", "http://[::ffff:192.168.1.1]/"]) {
      await expect(fetchPageMarkdown(url)).rejects.toThrow(/non-public/);
    }
    await expect(fetchPageMarkdown("ftp://93.184.216.34/")).rejects.toThrow(/protocol/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("re-checks redirect targets against the SSRF guard", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } })));
    await expect(fetchPageMarkdown("http://93.184.216.34/")).rejects.toThrow(/non-public/);
  });

  it("follows redirects and reports the final URL", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: URL) =>
      url.pathname === "/old"
        ? new Response(null, { status: 301, headers: { location: "/new" } })
        : htmlResponse(`<body><p>${PROSE}</p></body>`),
    ));
    const page = await fetchPageMarkdown("http://93.184.216.34/old");
    expect(page.url).toBe("http://93.184.216.34/new");
    expect(page.markdown).toContain("community health");
  });

  it("rejects non-HTML responses and HTTP errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("%PDF", { headers: { "content-type": "application/pdf" } })));
    await expect(crawlGrantPage("http://93.184.216.34/rfp.pdf")).rejects.toThrow(/content-type/);
    vi.stubGlobal("fetch", vi.fn(async () => htmlResponse("nope", { status: 404 })));
    await expect(crawlGrantPage("http://93.184.216.34/gone")).rejects.toThrow(/HTTP 404/);
  });
});

describe("crawlOrgSite", () => {
  it("drops thin and failing pages and de-duplicates identical ones", async () => {
    const about = `<body><main><h1>About</h1><p>${PROSE}</p></main></body>`;
    vi.stubGlobal("fetch", vi.fn(async (url: URL) => {
      switch (url.pathname) {
        case "/": return htmlResponse(`<body><main><h1>Home</h1><p>${PROSE}</p></main></body>`);
        case "/about":
        case "/about-us": return htmlResponse(about);
        case "/programs": return htmlResponse(`<body><nav><a href="/a">A</a></nav><p>Short.</p></body>`);
        default: return htmlResponse("missing", { status: 404 });
      }
    }));
    const pages = await crawlOrgSite("http://93.184.216.34/");
    expect(pages.map((p) => p.url)).toEqual(["http://93.184.216.34/", "http://93.184.216.34/about"]);
  });
});
