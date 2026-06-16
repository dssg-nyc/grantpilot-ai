import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage();

let matchesResponse = null;
page.on("response", async (res) => {
  if (res.url().includes("/api/matches") && res.request().method() === "GET") {
    try { matchesResponse = { status: res.status(), body: await res.json() }; } catch {}
  }
});

console.log("1. Login via real form...");
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "founder@ruralhealth.org");
await page.fill('input[name="password"]', "GrantPilot123!");
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard**", { timeout: 20000 });
console.log("   logged in -> ", page.url());

console.log("2. Navigate to /dashboard/matches...");
await page.goto(`${BASE}/dashboard/matches`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500); // let react-query settle

const cardCount = await page.locator("article").count();
const heading = await page.locator("h2").first().textContent();
await page.screenshot({ path: "scripts/matches-dashboard.png", fullPage: true });

console.log("\n=== RESULT ===");
console.log("heading:", heading);
console.log("match cards rendered:", cardCount);
console.log("/api/matches status:", matchesResponse?.status);
if (matchesResponse?.body) {
  console.log("stats:", JSON.stringify(matchesResponse.body.stats));
  console.log("first match:", matchesResponse.body.data?.[0]
    ? `[${matchesResponse.body.data[0].match_score}] ${matchesResponse.body.data[0].opportunity?.title}`
    : "none");
}
console.log("screenshot: scripts/matches-dashboard.png");

console.log("3. Navigate to /dashboard/opportunities (browse all funder types)...");
await page.goto(`${BASE}/dashboard/opportunities`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.screenshot({ path: "scripts/opportunities-dashboard.png", fullPage: true });
console.log("screenshot: scripts/opportunities-dashboard.png");

await browser.close();
