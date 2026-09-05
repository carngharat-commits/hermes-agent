/**
 * End-to-end user journeys with dummy data.
 *
 * The unit tests cover functions; this covers what a person actually does.
 * The "add to watchlist" bug survived a full unit suite and a smoke test
 * because nothing ever filled the form and pressed the button — so this file
 * drives every add path, in every segment, and asserts on what appears.
 *
 *   npm run dev                              # terminal 1
 *   npm i -D playwright && npx playwright install chromium
 *   node scripts/journeys.mjs                # terminal 2
 *
 * SMOKE_URL overrides the target; CHROMIUM_PATH overrides the browser.
 */
import { chromium } from "playwright";

const BASE = process.env.SMOKE_URL ?? "http://127.0.0.1:5273";
// The backend under test must be started with this passcode.
const PASSCODE = process.env.TRADEPULSE_PASSCODE ?? "demo-pass";

const results = [];
let browser;
let page;

function check(name, condition, detail = "") {
  results.push({ name, ok: Boolean(condition), detail });
  const mark = condition ? "  ok  " : " FAIL ";
  console.log(`${mark} ${name}${condition || !detail ? "" : `\n         ${detail}`}`);
}

async function main() {
  browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  );
  page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });

  const crashes = [];
  page.on("pageerror", (e) => crashes.push(e.message));

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);

  await journeyTheDoorIsLocked();
  await journeyFirstRunIsEmptyUntilAsked();
  await journeyAddWatchlistEverySegment();
  await journeyWatchlistValidation();
  await journeyAddHoldingEverySegment();
  await journeyHoldingValidation();
  await journeyHoldingReachesPortfolio();
  await journeyModeSwitchInSheet();
  await journeyRemoveFromWatchlist();
  await journeyPhotoIsNotClaimedToBeRead();
  await journeyEveryAICallIsExplainable();
  await journeyWatchlistShowsIntelligenceOnlyWhenPriced();
  await journeyAIChatNeverLeavesTheServer();
  await journeyQuotesFillBlanksButNeverOverwrite();

  check("no uncaught page errors during any journey", crashes.length === 0,
    crashes.join("\n         "));

  await browser.close();
  report();
}

// ---------------------------------------------------------------- helpers

async function openTab(name) {
  await page.getByRole("button", { name: new RegExp(`^${name}`) }).first().click();
  await page.waitForTimeout(350);
}

async function openWatchlist() {
  await openTab("Portfolio");
  await page.getByText("Manage").first().click();
  await page.waitForTimeout(400);
}

async function openAddSheet(from) {
  if (from === "watchlist") {
    await openWatchlist();
    const add = page.getByRole("button", { name: /Add/ }).first();
    await add.scrollIntoViewIfNeeded();
    await add.click();
  } else {
    await openTab("Portfolio");
    const add = page.getByRole("button", { name: /Add Position/ }).first();
    await add.scrollIntoViewIfNeeded();
    await add.click();
  }
  await page.waitForTimeout(500);
}

const SHEET = ".fixed.inset-0.z-50";

async function closeSheet() {
  // The X is the first button inside the sheet header.
  const x = page.locator(`${SHEET} button`).first();
  if (await x.count()) await x.click();
  await page.waitForTimeout(350);
  if (await page.locator(SHEET).count()) {
    throw new Error("sheet did not close — the X is not wired");
  }
}

/** The sheet has its own Watchlist / Owned toggle; a user switches in place. */
async function switchMode(mode) {
  await page.getByRole("button", { name: mode === "holding" ? "Owned" : "Watchlist", exact: true }).click();
  await page.waitForTimeout(250);
}

async function pickSegment(segment) {
  const labels = { IN: "IN Eq", US: "US Eq", MF: "MF", PM: "Metals", CR: "Crypto" };
  await page.getByRole("button", { name: labels[segment], exact: true }).click();
  await page.waitForTimeout(200);
}

async function nameField(segment) {
  return segment === "MF"
    ? page.getByPlaceholder("HDFC Flexi Cap Fund")
    : page.getByPlaceholder("e.g. RELIANCE");
}

async function missingHint() {
  // Short timeout on purpose. This is called to *describe* a failure, and the
  // hint is absent in the passing case — on Playwright's 30s default that is
  // half a minute burnt per successful check, which made a green run look like
  // a hung one and cost several minutes an execution.
  return page
    .locator("text=/Still need:/")
    .textContent({ timeout: 400 })
    .catch(() => null);
}

async function saveButton() {
  return page.getByRole("button", { name: /^Save / });
}

async function mainText() {
  return (await page.locator("main").innerText()).trim();
}

// ------------------------------------------------------------- journeys

// Only the broker routes used to check a session; every other screen was
// open to anyone with the URL. Now nothing renders and no /api route answers
// until the app's own passcode is given.
async function journeyTheDoorIsLocked() {
  console.log("\n— the app is locked until you sign in —");
  // A cold dev server can take seconds to serve the first bundle; wait for
  // the form rather than a fixed delay, so the first assertion reads a
  // rendered page and not an empty body.
  await page.locator("#passcode").waitFor({ timeout: 20000 });
  const body = await page.locator("body").innerText();
  check("a visitor sees the sign-in, not the app", /Sign in to continue/.test(body)
    && !/Portfolio Tracking/.test(body), body.slice(0, 200));

  // The lock is on the server, not just the screen.
  const status = await page.evaluate(() =>
    fetch("/api/intel/coverage", { credentials: "same-origin" }).then((r) => r.status));
  check("the API refuses without a session", status === 401, `HTTP ${status}`);

  await page.locator("#passcode").fill("not-the-passcode");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForTimeout(500);
  check("a wrong passcode is refused, with a reason",
    /not right/i.test(await page.locator("body").innerText()));

  await page.locator("#passcode").fill(PASSCODE);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForTimeout(900);
  const inside = await page.locator("body").innerText();
  check("the right passcode opens the app", /Dashboard|Portfolio/.test(inside)
    && !/Sign in to continue/.test(inside), inside.slice(0, 200));
  check("the sidebar shows who is signed in", /signed in/i.test(inside));

  const after = await page.evaluate(() =>
    fetch("/api/intel/coverage", { credentials: "same-origin" }).then((r) => r.status));
  check("the API answers once signed in", after === 200, `HTTP ${after}`);
}

// The app used to ship a real person's 126-row book as bundled constants, so
// every visitor saw it. It now starts empty and the demo book is opt-in. This
// runs first because every later journey assumes the demo book is loaded.
async function journeyFirstRunIsEmptyUntilAsked() {
  console.log("\n— first run starts empty; the demo book is opt-in —");
  await openTab("Portfolio");
  const fresh = await mainText();
  check("a fresh visitor sees an empty book", /Your book is empty/i.test(fresh),
    fresh.slice(0, 200));
  check("no holdings are pre-filled", /\b0 holdings\b/.test(fresh), fresh.slice(0, 200));
  check("the source badge says so", /\bEmpty\b/i.test(fresh));  // pill is CSS-uppercased
  check("no personal name is shown anywhere", !/Rahul|Gharat|Thane/.test(
    await page.locator("body").innerText()));

  await page.getByRole("button", { name: /Load demo book/ }).click();
  await page.waitForTimeout(600);
  const loaded = await mainText();
  check("loading the demo book fills the portfolio", !/Your book is empty/i.test(loaded)
    && /\d{2,} holdings/.test(loaded), loaded.slice(0, 200));
  check("the demo book is labelled as a demo", /Demo book/i.test(loaded));
  check("the demo can be cleared", await page.getByRole("button", { name: /Clear demo/ }).count() === 1);
}

/** Dummy rows, one per segment, shaped like something a person would type. */
const WATCHLIST_ROWS = [
  { segment: "IN", name: "INFY", target: "1650", label: "Indian equity" },
  { segment: "US", name: "NVDA", target: "180", label: "US equity" },
  { segment: "MF", name: "Nippon India multi cap fund", target: "1750", label: "mutual fund" },
  { segment: "PM", name: "GOLD", target: "7400", label: "precious metal" },
  { segment: "CR", name: "SOL", target: "250", label: "crypto" },
];

async function journeyAddWatchlistEverySegment() {
  console.log("\n— add to watchlist, every segment —");
  for (const row of WATCHLIST_ROWS) {
    await openAddSheet("watchlist");
    await pickSegment(row.segment);
    await (await nameField(row.segment)).fill(row.name);
    await page.getByPlaceholder("0.00").first().fill(row.target);
    await page.waitForTimeout(250);

    const save = await saveButton();
    const enabled = !(await save.isDisabled());
    check(`${row.label}: save enabled with name + target, no quantity`, enabled,
      `hint was ${JSON.stringify(await missingHint())}`);
    if (!enabled) {
      await closeSheet();
      continue;
    }
    await save.click();
    await page.waitForTimeout(500);

    const body = await mainText();
    check(`${row.label}: "${row.name}" appears in the watchlist`,
      body.includes(row.name), body.slice(0, 200));
  }

  const body = await mainText();
  check("all five watchlist entries coexist",
    WATCHLIST_ROWS.every((r) => body.includes(r.name)));
  check("no entry renders a meaningless 'Qty 0'", !/Qty 0\b/.test(body));
}

async function journeyWatchlistValidation() {
  console.log("\n— watchlist validation —");
  await openAddSheet("watchlist");

  check("empty form: save is disabled", await (await saveButton()).isDisabled());
  check("empty form: says what is missing", /symbol/.test(await missingHint() ?? ""));

  await pickSegment("MF");
  check("MF asks for a fund name, not a symbol",
    /fund name/.test(await missingHint() ?? ""), await missingHint());

  await (await nameField("MF")).fill("Some Fund");
  await page.waitForTimeout(250);
  const hint = await missingHint();
  check("name only: only the target rate is outstanding", hint === "Still need: target rate", hint);
  check("watchlist never demands a quantity", !/quantit|units/i.test(hint ?? ""), hint);

  await closeSheet();
}

const HOLDING_ROWS = [
  { segment: "IN", name: "WIPRO", qty: "40", avg: "245.5", label: "Indian equity" },
  { segment: "US", name: "AMZN", qty: "2", avg: "195", label: "US equity" },
  { segment: "MF", name: "Quant Small Cap Fund", qty: "120.5", avg: "98.4", label: "mutual fund" },
  { segment: "PM", name: "SILVER", qty: "25", avg: "92", label: "precious metal" },
  { segment: "CR", name: "DOT", qty: "300", avg: "6.2", label: "crypto" },
];

async function journeyAddHoldingEverySegment() {
  console.log("\n— add holding, every segment —");
  for (const row of HOLDING_ROWS) {
    await openAddSheet("holding");
    await pickSegment(row.segment);
    await (await nameField(row.segment)).fill(row.name);
    await page.getByPlaceholder("0").first().fill(row.qty);
    await page.getByPlaceholder("0.00").first().fill(row.avg);
    await page.waitForTimeout(250);

    const save = await saveButton();
    const enabled = !(await save.isDisabled());
    check(`${row.label} holding: save enabled with name + qty + cost`, enabled,
      `hint was ${JSON.stringify(await missingHint())}`);
    if (!enabled) {
      await closeSheet();
      continue;
    }
    await save.click();
    await page.waitForTimeout(600);
  }
}

async function journeyHoldingValidation() {
  console.log("\n— holding validation —");
  await openAddSheet("holding");
  await pickSegment("IN");
  await (await nameField("IN")).fill("TESTCO");
  await page.waitForTimeout(250);

  const hint = await missingHint();
  check("holding without qty/cost is blocked", await (await saveButton()).isDisabled());
  check("holding names both missing fields", /quantity/.test(hint ?? "") && /average cost/.test(hint ?? ""), hint);

  await page.getByPlaceholder("0").first().fill("10");
  await page.waitForTimeout(250);
  check("holding with qty still needs cost", /average cost/.test(await missingHint() ?? ""));

  await closeSheet();
}

async function journeyHoldingReachesPortfolio() {
  console.log("\n— a saved holding reaches the portfolio —");
  await openTab("Portfolio");
  const body = await mainText();
  // The Indian equity added above should have moved the IN holding count.
  check("portfolio page still renders after five adds", body.includes("Portfolio Tracking"));

  await page.getByText("Indian Equities").first().click();
  await page.waitForTimeout(600);
  const drill = await mainText();
  check("added Indian equity appears in the segment drill", drill.includes("WIPRO"),
    drill.slice(0, 200));

  await openTab("Portfolio");
  await page.getByText("Crypto").first().click();
  await page.waitForTimeout(600);
  check("added crypto appears in its segment", (await mainText()).includes("DOT"));
}

async function journeyModeSwitchInSheet() {
  console.log("\n— switching Watchlist/Owned inside the sheet —");
  await openAddSheet("watchlist");
  await pickSegment("IN");
  await (await nameField("IN")).fill("HDFCBANK");
  await page.getByPlaceholder("0.00").first().fill("1900");
  await page.waitForTimeout(250);
  check("watchlist mode: ready to save", !(await (await saveButton()).isDisabled()));

  await switchMode("holding");
  const hint = await missingHint();
  check("switching to Owned re-asks for quantity and cost",
    /quantity/.test(hint ?? "") && /average cost/.test(hint ?? ""), hint);
  check("switching to Owned disables save until they are given",
    await (await saveButton()).isDisabled());

  await switchMode("watchlist");
  check("switching back to Watchlist restores a saveable form",
    !(await (await saveButton()).isDisabled()), await missingHint());

  await closeSheet();
}

async function journeyRemoveFromWatchlist() {
  console.log("\n— remove from watchlist —");
  await openWatchlist();
  const before = await mainText();
  const had = before.includes("INFY");

  const removeButtons = page.locator("main button").filter({ has: page.locator("svg") });
  const count = await removeButtons.count();
  if (count === 0) {
    check("watchlist rows expose a remove control", false, "no buttons found");
    return;
  }
  await removeButtons.last().click();
  await page.waitForTimeout(500);

  const after = await mainText();
  check("removing an entry shortens the list", after.length < before.length || !had,
    `before ${before.length} chars, after ${after.length}`);
}

async function journeyPhotoIsNotClaimedToBeRead() {
  console.log("\n— the photo flow does not claim to read figures —");
  await openAddSheet("watchlist");
  const sheet = await page.locator("body").innerText();
  check("no 'Reading photo' claim anywhere in the sheet", !/Reading photo/i.test(sheet));
  check("photo is described as a reference shot",
    /reference photo/i.test(sheet), sheet.slice(0, 200));
  await closeSheet();
}

// The spec's hard rule: users should never see an unexplained AI decision.
// A bare `AI HOLD 32%` pill with nowhere to click was exactly that, and it was
// worst on the calls that most need explaining — the ones a portfolio brake
// pulled back from a BUY.
//
// Needs the backend running with at least one recommendation on file for a
// held, covered symbol. With no intelligence layer reachable the strip renders
// nothing at all, which is correct behaviour, so this journey skips rather
// than failing.
async function journeyEveryAICallIsExplainable() {
  console.log("\n— every AI call can be opened and explained —");
  await openTab("Portfolio");
  await page.getByText("Indian Equities").first().click();
  await page.waitForTimeout(1500);

  const links = page.getByText("why?", { exact: true });
  const count = await links.count();
  if (count === 0) {
    console.log("       skipped — no AI calls on file (backend not seeded)");
    return;
  }
  check("a covered holding shows an AI call", /AI (BUY|HOLD|REDUCE|SELL|AVOID)/
    .test(await mainText()));

  // Prefer a call a brake actually held back; that branch carries the
  // counterfactual and is the one most easily got wrong.
  let drawer = "";
  for (let i = 0; i < count; i++) {
    await links.nth(i).scrollIntoViewIfNeeded();
    await links.nth(i).click();
    await page.waitForTimeout(500);
    drawer = await page.locator("body").innerText();
    if (/held back by portfolio exposure/i.test(drawer)) break;
    if (i < count - 1) {
      await page.getByRole("button", { name: "Close" }).first().click();
      await page.waitForTimeout(250);
      drawer = "";
    }
  }
  check("the explanation drawer opens", /why the AI said this/i.test(drawer),
    drawer.slice(0, 200));
  check("it shows how the score was reached", /How the score was reached/i.test(drawer));
  check("it names the individual agents", /fundamental/i.test(drawer));
  check("it quotes an agent's own reasoning", /intrinsic value/i.test(drawer));
  check("it separates forecasts from portfolio brakes",
    /What the forecasters found/i.test(drawer) && /What your portfolio says/i.test(drawer));
  check("it states what was not considered, and why",
    /Not considered/i.test(drawer)
      && /news feed|language model|macro series/i.test(drawer));
  check("it shows provenance for the call", /Provenance/i.test(drawer)
    && /never overwritten/i.test(drawer));

  if (/held back by portfolio exposure/i.test(drawer)) {
    check("a brake that moved the score is explained",
      /not a reason to sell/i.test(drawer));
    // The counterfactual must only appear when the band actually changed.
    // Saying "would have been a BUY" on a call that IS a BUY reads as a
    // downgrade that never happened.
    const claimsChange = /Without it this would have been a\s+(BUY|HOLD|REDUCE|SELL)/
      .exec(drawer);
    const action = /\b(BUY|HOLD|REDUCE|SELL|AVOID)\s+\d+%/.exec(drawer);
    check("no counterfactual that restates the same call",
      !claimsChange || !action || claimsChange[1] !== action[1],
      `claimed ${claimsChange?.[1]} vs actual ${action?.[1]}`);
  }

  await page.getByRole("button", { name: "Close" }).first().click();
  await page.waitForTimeout(350);
  check("the drawer closes again",
    !/why the AI said this/i.test(await page.locator("body").innerText()));
}

// A watchlist row carries a target — what the user hopes to pay — and the add
// sheet backfills `ltp` from it when no market price is given. Valuing against
// that and calling the gap a discount to market would be a fabricated number,
// so the strip must appear for a priced row and stay away from an unpriced one.
//
// TITAN is used because it is one of the stub provider's covered symbols; an
// uncovered ticker renders nothing either way and would prove nothing.
async function journeyWatchlistShowsIntelligenceOnlyWhenPriced() {
  console.log("\n— watchlist intelligence appears only where there is a price —");

  // First: target only, no market price.
  await openAddSheet("watchlist");
  await pickSegment("IN");
  await (await nameField("IN")).fill("TITAN");
  await page.getByPlaceholder("0.00").nth(0).fill("2900");
  await (await saveButton()).click();
  await page.waitForTimeout(1400);

  let list = await mainText();
  check("target-only row is saved", list.includes("TITAN"), list.slice(0, 200));
  const titanBlock = list.slice(list.indexOf("TITAN"), list.indexOf("TITAN") + 320);
  check("target-only row claims no margin of safety",
    !/MOS|% over/i.test(titanBlock), titanBlock);

  // Then: the same symbol with a market price the user actually entered.
  await page.getByRole("button", { name: /Add/ }).first().click();
  await page.waitForTimeout(500);
  await pickSegment("IN");
  await (await nameField("IN")).fill("TITAN");
  await page.getByPlaceholder("0.00").nth(0).fill("2900");
  await page.getByPlaceholder("0.00").nth(1).fill("3400");   // current price
  await (await saveButton()).click();
  await page.waitForTimeout(1800);

  list = await mainText();
  const priced = list.slice(0, list.indexOf("TITAN") + 420);
  check("priced row shows an intrinsic value", /Intrinsic/i.test(priced), priced.slice(0, 300));
  check("priced row shows the margin against market", /MOS|% over/i.test(priced),
    priced.slice(0, 300));
  check("priced row compares the target to intrinsic value",
    /your target is/i.test(priced), priced.slice(0, 400));
}

// The drawer used to call Anthropic straight from the page: no key meant a
// failure, and a key would have shipped in the bundle to everyone. The call
// now goes through the backend. With no key on this test server the drawer
// must say so in words — and no request may leave for api.anthropic.com.
async function journeyAIChatNeverLeavesTheServer() {
  console.log("\n— the AI chat goes through the server, never the browser —");
  const leaks = [];
  const onRequest = (req) => { if (/anthropic\.com/.test(req.url())) leaks.push(req.url()); };
  page.on("request", onRequest);

  await openTab("Signals");
  // The actions row lives inside the expanded card.
  const reveal = page.getByRole("button", { name: /See reasoning/ }).first();
  if (await reveal.count()) { await reveal.scrollIntoViewIfNeeded(); await reveal.click(); await page.waitForTimeout(300); }
  const ask = page.getByRole("button", { name: /Ask AI/ }).first();
  if (await ask.count() === 0) {
    console.log("       skipped — no Ask AI entry point on the Signals tab");
    page.off("request", onRequest);
    return;
  }
  await ask.scrollIntoViewIfNeeded();
  await ask.click();
  await page.waitForTimeout(500);
  const box = page.locator(`${SHEET} input, ${SHEET} textarea`).first();
  check("the chat drawer opens with an input", await box.count() === 1);
  await box.fill("Why this call now?");
  await box.press("Enter");
  await page.waitForTimeout(1500);

  const body = await page.locator(SHEET).innerText();
  check("without a server key the drawer says so, in words",
    /not configured on this server|ANTHROPIC_API_KEY/i.test(body), body.slice(-300));
  check("no request left the page for api.anthropic.com", leaks.length === 0, leaks.join(", "));
  page.off("request", onRequest);
  await closeSheet();
}

// Quotes without a broker. With nothing configured the backend serves stub
// quotes, and the UI follows one rule: a stub may fill a price nobody
// supplied, never overwrite one somebody did, and never feeds a valuation.
async function journeyQuotesFillBlanksButNeverOverwrite() {
  console.log("\n— quotes fill blanks but never overwrite or value —");
  const status = await page.evaluate(() =>
    fetch("/api/quotes/status", { credentials: "same-origin" }).then((r) => r.json()));
  check("the backend reports its quote source honestly", status.source === "stub" && status.live === false,
    JSON.stringify(status));

  // A target-only watchlist row: the stub fills "Now", labelled, and still no MOS.
  await openAddSheet("watchlist");
  await pickSegment("IN");
  await (await nameField("IN")).fill("BHEL");
  await page.getByPlaceholder("0.00").nth(0).fill("300");
  await (await saveButton()).click();
  await page.waitForTimeout(1800);
  const list = await mainText();
  // Just this row: from its symbol to the next "SYMBOL / segment" header.
  // A fixed-width slice ran into the priced TITAN row beneath it.
  const block = (/BHEL\nIN\n[\s\S]*?(?=\n[A-Z][A-Z0-9 .]+\n(?:IN|US|MF|PM|CR)\n|$)/.exec(list) || [""])[0];
  check("a stub quote fills the missing price, and says it is a stub",
    /Now ₹[\d.]+/.test(block) && /stub quote/i.test(block), block);
  check("a stub quote never feeds a valuation", !/MOS|% over/i.test(block), block);

  // A demo holding with its own price: the stub must not move it.
  await openTab("Portfolio");
  await page.getByText("Indian Equities").first().click();
  await page.waitForTimeout(1500);
  const drill = await mainText();
  const axis = drill.slice(drill.indexOf("AXISBANK"), drill.indexOf("AXISBANK") + 160);
  check("a stub quote never overwrites a price the book already has",
    /1,?235\.40/.test(axis), axis);
}

function report() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.error("\nfailures:\n" + failed.map((f) => `  - ${f.name}`).join("\n"));
    process.exit(1);
  }
  console.log("all journeys green");
}

main().catch((e) => {
  console.error("harness error:", e.message);
  browser?.close();
  process.exit(1);
});
