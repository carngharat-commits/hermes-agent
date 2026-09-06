/**
 * Drives the self-contained prototype — the single HTML file that is
 * published as an artifact — with no backend at all.
 *
 *   node scripts/prototype-check.mjs path/to/tradepulse.html
 *
 * The published page is what the user actually opens, and it is a different
 * environment from the dev server: every /api call fails, so the app must
 * offer the read-only preview, say so on screen, and still let a visitor
 * load the demo book, walk every tab, and add a watchlist row without a
 * single uncaught error.
 */
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";

const file = process.argv[2];
if (!file) { console.error("usage: node scripts/prototype-check.mjs <file.html>"); process.exit(2); }

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: Boolean(ok) });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${ok || !detail ? "" : `\n         ${detail}`}`);
};

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const crashes = [];
page.on("pageerror", (e) => crashes.push(e.message));
const leaks = [];
page.on("request", (r) => { if (/anthropic\.com|api\.|kite\.zerodha/.test(r.url()) && !r.url().startsWith("file:")) leaks.push(r.url()); });

await page.goto(pathToFileURL(file).href, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
const body = () => page.locator("body").innerText();
const main = () => page.locator("main").innerText();

check("with no backend the page offers a read-only preview, not a sign-in",
  /Backend not reachable/.test(await body()) && /Open read-only preview/.test(await body()), (await body()).slice(0, 200));
await page.getByRole("button", { name: /Open read-only preview/ }).click();
await page.waitForTimeout(800);
check("the preview banner stays on screen", /Read-only preview/.test(await body()));
check("no personal name anywhere", !/Rahul|Gharat|Thane/.test(await body()));

await page.getByRole("button", { name: /^Portfolio/ }).first().click();
await page.waitForTimeout(500);
check("the book starts empty", /Your book is empty/.test(await main()));
await page.getByRole("button", { name: /Load demo book/ }).click();
await page.waitForTimeout(600);
check("the demo book loads and is labelled", /\d{2,} holdings/.test(await main()) && /demo book/i.test(await main()));

for (const tab of ["Dashboard", "Intelligence", "Signals", "Opportunities", "Calendar",
                   "Risk Audit", "AI Performance", "Orders", "Algo", "Accounts", "Settings"]) {
  await page.getByRole("button", { name: new RegExp(`^${tab}`) }).first().click();
  await page.waitForTimeout(350);
  const text = (await main()).trim();
  check(`${tab} renders without a backend`, text.length > 20, text.slice(0, 80));
}

// Add a watchlist row: the sheet must work with nothing to sync to.
await page.getByRole("button", { name: /^Portfolio/ }).first().click();
await page.waitForTimeout(400);
await page.getByText("Manage").first().click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: /Add/ }).first().click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: "IN Eq", exact: true }).click();
await page.getByPlaceholder("e.g. RELIANCE").fill("INFY");
await page.getByPlaceholder("0.00").first().fill("1650");
await page.getByRole("button", { name: /^Save / }).click();
await page.waitForTimeout(700);
check("a watchlist row can be added and appears", /INFY/.test(await main()));
check("no discount is invented for it with no backend", !/MOS|% over/i.test(await main()));

// The drill still opens and the explain link is simply absent (no calls on file).
await page.getByRole("button", { name: /Back|←/ }).first().click().catch(() => {});
await page.getByRole("button", { name: /^Portfolio/ }).first().click();
await page.waitForTimeout(400);
await page.getByText("Indian Equities").first().click();
await page.waitForTimeout(800);
check("the segment drill renders rows", /AXISBANK|RELIANCE|TCS/.test(await main()));
check("no AI call is claimed when there is nothing to explain", !/why\?/.test(await main()));

check("no request left the page for an external API", leaks.length === 0, leaks.join(", "));
check("no uncaught page errors", crashes.length === 0, crashes.join(" | "));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
