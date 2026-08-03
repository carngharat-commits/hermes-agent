/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

/* ----------------- BROKER REGISTRY (for Accounts tab) ------------------- */
export const BROKERS_CONNECTED = [
  { k:"zerodha", name:"Zerodha", tier:"Kite Connect ₹2,000/mo",  status:"active", holdings:88, ltp:"live",  auth:"OAuth2 + API",       last:"2min ago",  segments:["EQ","F&O","MF","GTT"], flag:"primary" },
  { k:"abml",    name:"Aditya Birla Money", tier:"ABMoney free ODIN", status:"active", holdings:24, ltp:"delayed", auth:"OTP · Client ID", last:"4h ago", segments:["EQ","F&O"], flag:"" },
  { k:"indmoney",name:"INDmoney", tier:"USD Stocks · Free",     status:"active", holdings:8,  ltp:"live",  auth:"OTP · Aadhaar",     last:"12min ago", segments:["US Eq","MF","NPS"], flag:"" },
  { k:"groww",   name:"Groww",    tier:"Trade API ₹499/mo",     status:"read-only", holdings:9, ltp:"live",  auth:"OTP · PAN",         last:"1h ago", segments:["MF","EQ"], flag:"" },
  { k:"coindcx", name:"CoinDCX",  tier:"Free API",              status:"active", holdings:4,  ltp:"live",  auth:"API Key + Secret",  last:"6min ago", segments:["Spot","Futures"], flag:"" },
  { k:"wazirx",  name:"WazirX",   tier:"Free API",              status:"limited", holdings:1,  ltp:"delayed", auth:"API Key",         last:"1d ago", segments:["Spot"], flag:"" },
  { k:"phonepe", name:"PhonePe",  tier:"Wallet · Digital Gold + Silver", status:"active", holdings:2, ltp:"live", auth:"UPI · OTP", last:"1h ago", segments:["Gold","Silver","Platinum"], flag:"" },
];

export const BROKERS_AVAILABLE = [
  { k:"dhanhq",  name:"DhanHQ",   tier:"FREE · Access Token",   auth:"Access token · single-click", segments:["EQ","F&O","MF"],   note:"Zero brokerage on delivery. Popular F&O infra." },
  { k:"fyers",   name:"FYERS",    tier:"FREE · OAuth 2.0",      auth:"OAuth 2.0 flow",              segments:["EQ","F&O","Commodity"], note:"Chart-heavy platform. Strong option chain data." },
  { k:"smartapi",name:"SmartAPI (Angel One)", tier:"FREE · TOTP",auth:"Client + Password + TOTP",   segments:["EQ","F&O","MF"],   note:"Angel One's API. TOTP required daily." },
  { k:"upstox",  name:"Upstox Pro", tier:"₹750/mo",             auth:"OAuth 2.0",                   segments:["EQ","F&O","MF"],   note:"Fast execution. Good for scalping." },
];
