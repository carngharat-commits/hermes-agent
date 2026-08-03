/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

/* ----------------- MOCK LIVE MARKET DATA (Dashboard) --------------------- */
export const MARKET = {
  nifty:     { val: 24812.55, chg:  179.32, chgPct:  0.73, high: 24856, low: 24698 },
  sensex:    { val: 81334.10, chg:  549.20, chgPct:  0.68, high: 81420, low: 80912 },
  banknifty: { val: 53241.75, chg: -117.10, chgPct: -0.22, high: 53410, low: 53182 },
  indiavix:  { val: 13.42,    chg:   -0.29, chgPct: -2.15 },
  niftypcr:  1.18,
  deliveryPct: 44.2,
};

export const MOOD = {
  score: 6.8, label: "Cautiously Bullish", phase: "Late Cycle",
  breakdown: { technical: 7.2, breadth: 6.9, flows: 7.4, volatility: 5.8, sentiment: 6.5 },
};

export const FLOWS = {
  fii: { session: 1248, last5: 5842, trend: "accumulating" },
  dii: { session:  892, last5: 4361, trend: "supporting" },
};

export const INSIGHTS = [
  { id:1, tone:"warn", title:"IRCTC breaks 200-DMA — cut or hold?",
    body:"Your position −49% (−₹9,540). Fresh downtrend below ₹500 support. Consider tax-loss harvest before FY-end.",
    action:"Review position", impact:"IN Eq · ₹9.9K" },
  { id:2, tone:"up", title:"Fed 25bp cut priced in for Sep FOMC",
    body:"US rate expectations turning dovish. Positive setup for your GOOG/META (+₹1.2L exposure). Watch DXY at 100.",
    action:"See US positions", impact:"US Eq · ₹47K" },
  { id:3, tone:"info", title:"Crude softens to $71 — HPCL/MRPL beneficial",
    body:"Refining margins improve at lower feedstock. Your HPCL + MRPL combined ₹25K in Zerodha stand to gain.",
    action:"See sector", impact:"IN Energy · ₹25K" },
  { id:4, tone:"down", title:"SHIB / WIN — book losses before FY-end",
    body:"Down 82% and 96%. VDA losses don't offset equity but frees ₹1.1K residual capital. See Crypto Plan.",
    action:"Crypto plan", impact:"CR · ₹1.1K" },
  { id:5, tone:"info", title:"MF Regular commissions leaking ₹17K/yr",
    body:"₹14.5L in Regular Growth. Switch to Direct plans to save 1.2% p.a. Check exit-load calendar.",
    action:"MF costs", impact:"MF · ₹17K/yr" },
];

export const MACRO_TEASER = {
  brief: "Global risk-on: Fed dovish tilt, softening crude, ₹ stable at 85.00. India: monsoon 4% above LPA, RBI status quo expected.",
  events: [
    { d:"Aug 06", label:"RBI MPC decision", weight:"HIGH" },
    { d:"Aug 12", label:"CPI print (Jul)", weight:"MED" },
    { d:"Sep 16", label:"Fed FOMC", weight:"HIGH" },
  ],
};

/* ----------------- PORTFOLIO HISTORY (for Dashboard chart) --------------- */
// Seeded random walk ending at ~₹25L today
export const _seedRand = (seed) => { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };

export const _genHistory = (points, endValue, volPct, seed) => {
  const rand = _seedRand(seed);
  const arr = new Array(points);
  let v = endValue * (1 - (rand() - 0.5) * 0.2); // start ~10-15% away
  const trend = (endValue - v) / points;
  for (let i = 0; i < points; i++) {
    v += trend + (rand() - 0.5) * endValue * volPct;
    arr[i] = Math.max(v, endValue * 0.6);
  }
  arr[points - 1] = endValue;
  return arr;
};

export const PORTFOLIO_HISTORY = {
  "7D":  { points: 7,   startDaysAgo: 7,   vol: 0.008, seed: 101 },
  "1M":  { points: 30,  startDaysAgo: 30,  vol: 0.012, seed: 217 },
  "3M":  { points: 45,  startDaysAgo: 90,  vol: 0.018, seed: 331 },
  "1Y":  { points: 52,  startDaysAgo: 365, vol: 0.028, seed: 457 },
  "All": { points: 60,  startDaysAgo: 730, vol: 0.035, seed: 599 },
};
