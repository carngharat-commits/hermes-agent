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

  await journeyAddWatchlistEverySegment();
  await journeyWatchlistValidation();
  await journeyAddHoldingEverySegment();
  await journeyHoldingValidation();
  await journeyHoldingReachesPortfolio();
  await journeyModeSwitchInSheet();
  await journeyRemoveFromWatchlist();
  await journeyPhotoIsNotClaimedToBeRead();

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
  return page.locator("text=/Still need:/").textContent().catch(() => null);
}

async function saveButton() {
  return page.getByRole("button", { name: /^Save / });
}

async function mainText() {
  return (await page.locator("main").innerText()).trim();
}

// ------------------------------------------------------------- journeys

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
