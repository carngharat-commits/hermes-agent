/**
 * Browser smoke test: every tab renders, and the Kite connect flow round-trips.
 *
 *   npm run dev                              # terminal 1 (backend running too)
 *   npm i -D playwright                      # not a workspace dep: installing
 *   npx playwright install chromium          # it downloads ~150MB of browser
 *   node scripts/smoke.mjs                   # terminal 2
 *
 * Override the target with SMOKE_URL, and the browser with CHROMIUM_PATH.
 */
import { chromium } from "playwright";

const BASE = process.env.SMOKE_URL ?? "http://127.0.0.1:5273";
const TABS = [
  "Dashboard", "Intelligence", "Portfolio", "Signals", "Opportunities",
  "Calendar", "Risk Audit", "Orders", "Algo", "Accounts", "Settings",
];

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
// Console entries for failed subresources carry no URL, so check requests
// directly. Google Fonts is the one external dependency; a blocked CDN (or an
// offline machine) is not an app failure.
const external = (url) => !url.startsWith(BASE);
page.on("requestfailed", (r) => {
  if (!external(r.url())) errors.push(`request failed: ${r.url()}`);
});
page.on("response", (r) => {
  if (r.status() >= 400 && !external(r.url())) {
    errors.push(`HTTP ${r.status()}: ${r.url()}`);
  }
});

await page.goto(BASE, { waitUntil: "networkidle" });

for (const tab of TABS) {
  await page.getByRole("button", { name: new RegExp(`^${tab}`) }).first().click();
  await page.waitForTimeout(250);
  const text = (await page.locator("main").innerText()).trim();
  if (!text) errors.push(`${tab}: main rendered empty`);
  console.log(`  ${tab.padEnd(14)} ${text.split("\n")[0].slice(0, 46)}`);
}

// Before connecting, holdings are the bundled snapshot.
const badge = async () => {
  await page.getByRole("button", { name: /^Portfolio/ }).first().click();
  await page.waitForTimeout(300);
  // Pill renders uppercase via CSS, and innerText reflects that.
  const found = (await page.locator("main").innerText()).match(/kite live|kite stub|snapshot/i);
  return found?.[0].toLowerCase();
};

const before = await badge();
if (before !== "snapshot") errors.push(`portfolio: expected snapshot before connecting, got ${before}`);
else console.log("  Portfolio src  Snapshot (not connected)");

// Kite connect round trip (stub mode bounces straight back through /callback).
await page.getByRole("button", { name: /^Accounts/ }).first().click();
const connect = page.getByRole("button", { name: "Connect Zerodha" });
if (await connect.count()) {
  await connect.click();
  await page.waitForURL((u) => !u.searchParams.has("kite_error"), { timeout: 15000 });
  await page.getByRole("button", { name: /^Accounts/ }).first().click();
  const connected = await page.getByText(/Connected as/).count();
  if (!connected) errors.push("kite: connect did not produce a session");
  else console.log("  Kite connect   session established");
} else {
  console.log("  Kite connect   skipped (already connected)");
}

// ...and after connecting, the Zerodha slice is live and the rest is not.
const after = await badge();
if (after !== "kite stub") errors.push(`portfolio: expected kite stub after connecting, got ${after}`);
else console.log("  Portfolio src  Kite stub (Zerodha slice synced)");

await page.getByRole("button", { name: /^Portfolio/ }).first().click();
await page.getByText("Indian Equities").first().click();
await page.waitForTimeout(400);
const drill = await page.locator("main").innerText();
if (!drill.includes("RELIANCE")) errors.push("portfolio: live RELIANCE row missing after sync");
if (drill.includes("AEQUS")) errors.push("portfolio: snapshot Zerodha rows survived the sync");
if (!drill.includes("SBIN")) errors.push("portfolio: non-Zerodha (ABML) rows were wrongly dropped");
if (!errors.length) console.log("  Holdings merge live Zerodha rows in, snapshot Zerodha rows out, ABML kept");

// Orders follow the same merge rule.
await page.getByRole("button", { name: /^Orders/ }).first().click();
await page.waitForTimeout(400);
const book = await page.locator("main").innerText();
if (!/kite stub/i.test(book)) errors.push("orders: expected the source badge to read Kite stub");
if (!book.includes("Insufficient margin")) errors.push("orders: live rejected order missing");
if (book.includes("O-1042")) errors.push("orders: snapshot Zerodha orders survived the sync");
if (!book.includes("O-1038")) errors.push("orders: non-Zerodha (INDmoney) order was wrongly dropped");
else console.log("  Orders merge   live Zerodha orders in, INDmoney order kept");

await page.getByRole("button", { name: /^GTT Orders/ }).first().click();
await page.waitForTimeout(400);
const gtt = await page.locator("main").innerText();
// The two-leg TATASTEEL trigger must render as two rows, not one.
if ((gtt.match(/TATASTEEL/g) ?? []).length < 2) errors.push("gtt: two-leg trigger did not split into two rows");
else console.log("  GTT split      two-leg trigger renders as two rows");

await browser.close();

if (errors.length) {
  console.error(`\n${errors.length} failure(s):\n` + errors.join("\n"));
  process.exit(1);
}
console.log("\nsmoke ok");
