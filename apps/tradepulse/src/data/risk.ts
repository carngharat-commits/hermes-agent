/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

export const SECTOR_BETA = {
  Banking:1.15, Financials:1.20, IT:0.90, Auto:1.30, Metals:1.55, Energy:1.10,
  Utilities:0.80, Consumer:0.70, Pharma:0.65, Industrials:1.25, Defence:1.10,
  Chemicals:1.15, Infra:1.35, Telecom:1.05, Internet:1.40, Services:1.10, Textiles:1.20,
  ETF:1.00, Others:1.00,
};

// Stress scenarios: compute impact on user's book
export const STRESS_SCENARIOS = [
  { id:1, name:"Nifty −10% correction", 
    desc:"Broad market draw-down. Beta-adjusted impact per segment.",
    weight:"HIGH", tone:"down",
    sectorImpacts:{ Banking:-11.5, IT:-9, Auto:-13, Metals:-15.5, Energy:-11, Consumer:-7, Pharma:-6.5, Utilities:-8, Others:-10 },
    globalUSImpact:-5, mfImpact:-9, cryptoImpact:-15 },
  { id:2, name:"Iran flare-up · Crude +$20",
    desc:"Middle East conflict spikes oil above $90. Refiners hurt, upstream benefits.",
    weight:"MED", tone:"warn",
    sectorImpacts:{ Banking:-2, IT:-1, Auto:-8, Metals:0, Energy:+12, Consumer:-3, Pharma:0, Utilities:-2, Others:-1 },
    globalUSImpact:-3, mfImpact:-2, cryptoImpact:-5,
    winners:["ONGC","COALINDIA"], losers:["HPCL","MRPL","IGL","PETRONET","M&M","MOTHERSON","EICHERMOT"] },
  { id:3, name:"Fed surprise +50bp hike",
    desc:"Hawkish Powell forces EM outflows. Growth stocks hit hardest.",
    weight:"MED", tone:"down",
    sectorImpacts:{ Banking:-5, IT:-8, Auto:-6, Metals:-4, Energy:-3, Consumer:-4, Pharma:-3, Utilities:-2, Others:-4 },
    globalUSImpact:-8, mfImpact:-5, cryptoImpact:-20 },
  { id:4, name:"China stimulus disappoints",
    desc:"Beijing under-delivers on Q4 stimulus. Metals/commodity demand slumps.",
    weight:"LOW", tone:"down",
    sectorImpacts:{ Banking:-1, IT:-1, Auto:-3, Metals:-14, Energy:-4, Consumer:-1, Pharma:0, Utilities:-1, Others:-2 },
    globalUSImpact:-1, mfImpact:-2, cryptoImpact:-3 },
  { id:5, name:"USD-INR to 88 (rupee weakens ₹3)",
    desc:"INR depreciates. US book benefits proportionally.",
    weight:"MED", tone:"warn",
    sectorImpacts:{ Banking:0, IT:+3, Auto:-2, Metals:+1, Energy:+2, Consumer:-1, Pharma:+2, Utilities:0, Others:0 },
    globalUSImpact:+3.5, mfImpact:0, cryptoImpact:0 },
  { id:6, name:"Trump 20% blanket tariff",
    desc:"US enacts campaign-signaled tariff. Auto & export IT services affected.",
    weight:"LOW", tone:"warn",
    sectorImpacts:{ Banking:-1, IT:-4, Auto:-8, Metals:-3, Energy:-2, Consumer:-2, Pharma:-1, Utilities:0, Others:-1 },
    globalUSImpact:-4, mfImpact:-2, cryptoImpact:-5,
    losers:["M&M","MOTHERSON","TATAMOTORS","TATATECH","TCS"] },
];

/* ----------------- REBALANCE MODEL PORTFOLIOS ---------------------------- */
export const MODEL_PORTFOLIOS = [
  { k:"conservative", name:"Conservative", risk:"LOW",
    targets:{ IN_EQ:35, US_EQ:5, MF:40, PM:5, CR:2, CASH:13 },
    desc:"Wealth preservation focus. Emphasis on debt MFs, large-cap equity, minimal crypto." },
  { k:"balanced", name:"Balanced", risk:"MED",
    targets:{ IN_EQ:45, US_EQ:10, MF:32, PM:3, CR:3, CASH:7 },
    desc:"Growth + preservation mix. Suits 5-10y horizon with steady contributions." },
  { k:"aggressive", name:"Aggressive", risk:"HIGH",
    targets:{ IN_EQ:60, US_EQ:15, MF:16, PM:2, CR:5, CASH:2 },
    desc:"Wealth accumulation focus. Higher volatility tolerance, longer horizon (10y+)." },
];

/* ----------------- CORRELATION MATRIX ------------------------------------ */
export const CORR = {
  labels:["IN Eq","US Eq","MF","Crypto","Gold","INR"],
  matrix:[
    [1.00, 0.42, 0.86, 0.28, -0.15, 0.22],
    [0.42, 1.00, 0.45, 0.51, -0.05, -0.68],
    [0.86, 0.45, 1.00, 0.30, -0.12, 0.20],
    [0.28, 0.51, 0.30, 1.00,  0.10, -0.24],
    [-0.15,-0.05,-0.12,0.10,  1.00,  0.35],
    [0.22,-0.68, 0.20,-0.24,  0.35,  1.00],
  ],
};

/* ----------------- CRYPTO PLAN ------------------------------------------- */
export const CRYPTO_PLAN = [
  { sym:"TRX",  name:"Tron",      verdict:"HOLD",   confidence:71,
    reason:"Winner at +260%. Utility-driven L1 with stable transaction volume.", 
    action:"Consider trimming 30% to lock ₹4.4K gain. Retain core for compounding." },
  { sym:"XRP",  name:"Ripple",    verdict:"HOLD",   confidence:64,
    reason:"Regulatory clarity improving. Cross-border payments use-case strong.",
    action:"Hold. Consider 10-15% add on any dip below ₹100 (breakeven zone)." },
  { sym:"SHIB", name:"Shiba Inu", verdict:"EXIT",   confidence:88,
    reason:"Meme coin with declining social + on-chain metrics. Down 82%.",
    action:"Exit fully. Book ₹4.4K loss. Note: VDA losses don't offset equity gains under 115BBH." },
  { sym:"WIN",  name:"WINkLink",  verdict:"EXIT",   confidence:92,
    reason:"TRX ecosystem token, weak fundamentals. Down 96%.",
    action:"Exit. Remaining ₹212 residual — book loss and free the position." },
  { sym:"AINFT",name:"AINFT",     verdict:"IGNORE", confidence:80,
    reason:"Airdrop token. Zero invested capital. Speculative NFT theme.",
    action:"Hold as free option. Zero cost basis means no downside." },
];

/* ----------------- MF EXIT LOAD DATA ------------------------------------ */
export const MF_EXIT_DATA = [
  { name:"HDFC Flexi Cap Fund",             defaultPurchase:"2024-03-15", exitLoadPct:1.0, lockDays:365 },
  { name:"Parag Parikh Flexi Cap Fund",     defaultPurchase:"2023-11-10", exitLoadPct:2.0, lockDays:365 },
  { name:"Invesco India Financial Services Fund", defaultPurchase:"2024-05-20", exitLoadPct:1.0, lockDays:365 },
  { name:"ICICI Pru Value Fund",            defaultPurchase:"2023-08-05", exitLoadPct:1.0, lockDays:365 },
  { name:"WOC Multi Cap Fund",              defaultPurchase:"2024-01-12", exitLoadPct:1.0, lockDays:365 },
  { name:"Edelweiss Large Cap Fund",        defaultPurchase:"2023-06-18", exitLoadPct:1.0, lockDays:365 },
  { name:"Canara Rob Large Cap Fund",       defaultPurchase:"2023-04-22", exitLoadPct:1.0, lockDays:365 },
  { name:"SBI Focused Fund",                defaultPurchase:"2022-09-30", exitLoadPct:1.0, lockDays:365 },
  { name:"WOC Ultra Short Duration Fund",   defaultPurchase:"2024-06-01", exitLoadPct:0.0, lockDays:0 },
  { name:"Tata Retirement Savings Moderate Fund", defaultPurchase:"2019-04-01", exitLoadPct:1.0, lockDays:1825 },
];
