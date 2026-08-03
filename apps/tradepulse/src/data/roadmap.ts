/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */


/* ----------------- ROADMAP TO PRODUCTION -------------------------------- */
export const ROADMAP = [
  { step:1, title:"Broker API integrations",              weeks:"3-5", cost:"₹2,500-4,500/mo",
    goal:"Replace all mock holdings with live data",
    // `shipped` is what actually exists in this build, as opposed to `todos`,
    // which is the original plan. Keep the two honest against each other.
    shipped:[
      "Zerodha Kite Connect — OAuth login, server-held access token, logout",
      "Kite holdings sync — replaces the Zerodha slice of the bundled snapshot",
      "Kite order book + GTT triggers sync",
    ],
    todos:[
      "Zerodha: daily token refresh (tokens expire ~6am IST — currently re-login)",
      "INDmoney public API — US Eq + MF sync",
      "ABML: no public API — build ODIN Diet scraper OR add CSV/PDF upload flow",
      "CoinDCX + WazirX REST APIs (both free with API key + secret)",
      "PhonePe: no public API — OCR the screenshot flow + manual entry fallback",
      "Groww Trade API (₹499/mo) — orders + holdings mirror",
    ] },
  { step:2, title:"Live market data feeds",               weeks:"1-2", cost:"₹500-2,000/mo",
    goal:"Replace mock indices, VIX, FII/DII with live streams",
    todos:[
      "Nifty/Sensex/BankNifty ticks: piggyback on Kite websocket (included in Kite Connect)",
      "India VIX + PCR + delivery %: NSE public data (scrape) or Trendlyne API",
      "FII/DII flows: NSE EOD provisional reports (scrape every 6pm)",
      "USD/INR: RBI reference rate (free, EOD) or Fyers ₹500/mo for intraday",
      "US stock LTPs: IEX Cloud free tier or Polygon.io ($29/mo)",
    ] },
  { step:3, title:"News + geopolitical feed",             weeks:"3-4", cost:"₹1,500-8,000/mo",
    goal:"Replace mock geopol events with real news + impact scoring",
    todos:[
      "Free tier: Moneycontrol RSS + Economic Times RSS + Reuters public RSS",
      "Twitter/X API v2 basic tier ($200/mo) for real-time market chatter",
      "Impact scoring: LLM prompt engineering on each news item → per-sector sensitivity",
      "Portfolio impact math: multiply sensitivity × user's exposure per symbol",
      "Optional premium: Bloomberg Terminal API (~₹1.7L/mo) or Refinitiv Eikon (~₹1L/mo)",
    ] },
  { step:4, title:"Signals + Opportunities engine",       weeks:"6-10", cost:"₹1,000-5,000/mo",
    goal:"Replace demo signals with real technical + fundamental + macro scoring",
    todos:[
      "Backtest infra: Backtrader or VectorBT (both free, Python) with your OHLCV feed",
      "Technical indicators: TA-Lib (free) for RSI, MACD, MA, breakout patterns",
      "Fundamental data: Screener.in via scraping or Trendlyne API (~₹1,500/mo)",
      "Macro data: RBI Data Warehouse (free) + MOSPI + US Fed APIs (free)",
      "Scoring: weight T/F/M axes → composite confidence · risk from vol + correlation + macro",
      "Failure scenario: rules-based (e.g., \"if RSI > 80 and Fed pivots, cut confidence\")",
    ] },
  { step:5, title:"Top investor tracking",                weeks:"2-3", cost:"₹500-3,000/mo",
    goal:"Real Jhunjhunwala/Damani/FII moves affecting your book",
    todos:[
      "BSE quarterly shareholding pattern scraper (free) — 1%+ holders per company",
      "Trendlyne Premium API (~₹1,500/mo) — pre-parsed investor portfolios",
      "Insider buy/sell filings: NSE/BSE SAST + PIT filings (free, scrape)",
      "Mutual fund monthly filings: AMFI EOD portfolios (free) — parse XML",
      "FII holdings: NSDL + CDSL FPI reports (free, EOD)",
      "Cross-ref engine: match each move against user's holdings → surface only relevant",
    ] },
  { step:6, title:"Backend + hosting",                    weeks:"3-4", cost:"₹3,000-8,000/mo",
    goal:"Persistent state, cache, real-time updates",
    todos:[
      "Node.js/Python API server (Express/FastAPI)",
      "PostgreSQL for holdings, trades, signals history",
      "Redis for market data cache + rate limiting",
      "WebSocket server (Socket.io) for real-time LTP push to app",
      "AWS/GCP hosting: ₹2,500/mo for t3.small + RDS + Redis",
      "Cloudflare CDN (free tier) + monitoring (Sentry free tier)",
    ] },
  { step:7, title:"Compliance + legal",                   weeks:"6-12", cost:"₹1L one-time + ₹15K/mo",
    goal:"Legal to publish and (optionally) monetize",
    todos:[
      "If personal use: no license needed. If sharing with others: SEBI Investment Adviser (IA) OR Research Analyst (RA) registration",
      "SEBI IA: ₹5L capital adequacy, NISM certification, ₹1L application fee, annual audit",
      "SEBI RA: lighter — ₹1L capital, NISM XV cert, one-time filing",
      "DPDP Act 2023: user consent flows + data localization + privacy policy",
      "IT Act 43A: encryption at rest for user data",
      "Signal audit trail: log every signal shown with timestamp for regulatory review",
      "Disclaimers throughout app (already implemented in this build)",
    ] },
];
