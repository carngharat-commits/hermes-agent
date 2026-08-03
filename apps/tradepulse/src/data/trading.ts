/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

/* ----------------- CALENDAR EVENTS -------------------------------------- */
export const CALENDAR = [
  // Aug 2026
  { d:"2026-08-04", label:"Nifty PSU Bank rejig announcement",  type:"index",  weight:"LOW",  affects:["CANBK","SBIN","IDBI","IOB"] },
  { d:"2026-08-05", label:"US July NFP + wage data",            type:"macro",  weight:"MED",  affects:["GOOG","META","MCD","CMCSA","DVN"] },
  { d:"2026-08-06", label:"RBI MPC decision",                   type:"macro",  weight:"HIGH", affects:["CANBK","AXISBANK","IDFCFIRSTB","FEDERALBNK","BAJFINANCE","CHOLAFIN","BAJAJHFL","LTF","IREDA","IRFC","PFC","IEX","MOBIKWIK","FIVESTAR","GROWW"] },
  { d:"2026-08-08", label:"BHEL Q1 results",                    type:"earnings", weight:"MED", affects:["BHEL"] },
  { d:"2026-08-08", label:"RELIANCE Q1 results",                type:"earnings", weight:"HIGH", affects:["RELIANCE"] },
  { d:"2026-08-10", label:"CANBK Q1 results",                   type:"earnings", weight:"HIGH", affects:["CANBK"] },
  { d:"2026-08-11", label:"COALINDIA Q1 results",               type:"earnings", weight:"MED",  affects:["COALINDIA"] },
  { d:"2026-08-12", label:"India CPI (July) print",             type:"macro",  weight:"MED",  affects:["Broad market · rate-sensitive"] },
  { d:"2026-08-13", label:"India IIP + US CPI",                 type:"macro",  weight:"MED",  affects:["GOOG","META","MCD","VZM","CMCSA","DVN"] },
  { d:"2026-08-14", label:"AXISBANK Q1 results",                type:"earnings", weight:"HIGH", affects:["AXISBANK"] },
  { d:"2026-08-14", label:"TATAMOTORS + M&M Q1 results",        type:"earnings", weight:"HIGH", affects:["TATAMOTORS","M&M","MOTHERSON","EICHERMOT"] },
  { d:"2026-08-15", label:"Independence Day · Markets closed",  type:"holiday",weight:"LOW",  affects:[] },
  { d:"2026-08-18", label:"TATASTEEL Q1 results",               type:"earnings", weight:"MED",  affects:["TATASTEEL","HINDALCO","WELCORP","LLOYDSME"] },
  { d:"2026-08-20", label:"TITAN + GODREJCP Q1 results",        type:"earnings", weight:"MED",  affects:["TITAN","GODREJCP","TATACONSUM","HAVELLS"] },
  { d:"2026-08-22", label:"Jackson Hole symposium begins",      type:"geopol", weight:"HIGH", affects:["GOOG","META","MCD","CMCSA","DVN","VZM","MF USD-linked"] },
  { d:"2026-08-25", label:"OPEC+ ministerial meeting",          type:"geopol", weight:"MED",  affects:["HINDPETRO","MRPL","IGL","PETRONET","ONGC","COALINDIA"] },
  { d:"2026-08-28", label:"India Q1 GDP print",                 type:"macro",  weight:"HIGH", affects:["Broad market"] },
  { d:"2026-08-30", label:"US PCE (Fed's preferred inflation)", type:"macro",  weight:"HIGH", affects:["GOOG","META","MCD","VZM","CMCSA","DVN"] },
  // Sep 2026
  { d:"2026-09-02", label:"US ISM Manufacturing",               type:"macro",  weight:"MED",  affects:["META","GOOG","DVN"] },
  { d:"2026-09-05", label:"US August NFP",                      type:"macro",  weight:"HIGH", affects:["GOOG","META","MCD","CMCSA","DVN","MF USD-linked"] },
  { d:"2026-09-11", label:"India CPI (August)",                 type:"macro",  weight:"MED",  affects:["Broad market"] },
  { d:"2026-09-12", label:"US CPI (August)",                    type:"macro",  weight:"HIGH", affects:["GOOG","META","MCD","CMCSA","DVN","MF USD-linked"] },
  { d:"2026-09-16", label:"Fed FOMC decision",                  type:"macro",  weight:"HIGH", affects:["GOOG","META","MCD","VZM","CMCSA","DVN","MF USD-linked","CANBK","AXISBANK","IDFCFIRSTB"] },
  { d:"2026-09-22", label:"India Union Cabinet · budget signals", type:"geopol", weight:"MED", affects:["BHEL","MAZDOCK","BDL","DATAPATTNS","NCC","RITES"] },
  { d:"2026-09-30", label:"India Q2 advance tax collections",   type:"macro",  weight:"LOW",  affects:["Broad market"] },
];

/* ----------------- ORDERS + TRADES (mock — decision-support layer) ------ */
export const ORDERS = [
  // Recent completed
  { id:"O-1042", sym:"BAJFINANCE", side:"BUY",  type:"CNC", qty:10, price:736.40, status:"EXECUTED", broker:"Zerodha", when:"2026-07-29 09:32", segment:"IN" },
  { id:"O-1041", sym:"LLOYDSME",   side:"BUY",  type:"CNC", qty:2,  price:1750.00, status:"EXECUTED", broker:"Zerodha", when:"2026-07-28 10:15", segment:"IN" },
  { id:"O-1040", sym:"AXISBANK",   side:"BUY",  type:"CNC", qty:3,  price:1198.75, status:"EXECUTED", broker:"Zerodha", when:"2026-07-25 14:22", segment:"IN" },
  { id:"O-1039", sym:"MRPL",       side:"SELL", type:"MIS", qty:20, price:167.20, status:"EXECUTED", broker:"Zerodha", when:"2026-07-24 15:08", segment:"IN" },
  { id:"O-1038", sym:"GOOG",       side:"BUY",  type:"CNC", qty:0.5, price:329.40, status:"EXECUTED", broker:"INDmoney", when:"2026-07-23 20:15", segment:"US" },
  // Pending
  { id:"O-1043", sym:"CIPLA",      side:"BUY",  type:"CNC", qty:5,  price:1500.00, status:"PENDING", broker:"Zerodha", when:"2026-07-31 09:15", segment:"IN" },
  { id:"O-1044", sym:"HDFCBANK",   side:"BUY",  type:"CNC", qty:3,  price:1685.00, status:"PENDING", broker:"Zerodha", when:"2026-07-31 09:16", segment:"IN" },
  // Rejected
  { id:"O-1037", sym:"IRCTC",      side:"SELL", type:"CNC", qty:20, price:501.00, status:"REJECTED", broker:"Zerodha", when:"2026-07-22 11:04", segment:"IN", reason:"Insufficient balance" },
  // Older
  { id:"O-1025", sym:"MOTHERSON",  side:"BUY",  type:"CNC", qty:30, price:110.89, status:"EXECUTED", broker:"Zerodha", when:"2026-06-10 10:44", segment:"IN" },
  { id:"O-1024", sym:"EICHERMOT",  side:"BUY",  type:"CNC", qty:2,  price:5357.18, status:"EXECUTED", broker:"Zerodha", when:"2026-06-08 13:20", segment:"IN" },
];

export const GTT_ORDERS = [
  { id:"G-201", sym:"IRCTC",   trigger:550,  action:"SELL", qty:20, status:"ACTIVE",   broker:"Zerodha", created:"2026-07-15", note:"Book on rally · tax-loss harvest" },
  { id:"G-202", sym:"WELCORP", trigger:1900, action:"SELL", qty:3,  status:"ACTIVE",   broker:"Zerodha", created:"2026-07-18", note:"Book partial gain" },
  { id:"G-203", sym:"LLOYDSME",trigger:2400, action:"SELL", qty:5,  status:"ACTIVE",   broker:"Zerodha", created:"2026-07-20", note:"Target hit" },
  { id:"G-204", sym:"IRCTC",   trigger:450,  action:"SELL", qty:20, status:"ACTIVE",   broker:"Zerodha", created:"2026-07-15", note:"Stop loss" },
  { id:"G-205", sym:"CANBK",   trigger:145,  action:"SELL", qty:80, status:"ACTIVE",   broker:"Zerodha", created:"2026-07-22", note:"Partial book at target" },
  { id:"G-206", sym:"MRPL",    trigger:195,  action:"SELL", qty:100,status:"TRIGGERED",broker:"Zerodha", created:"2026-06-30", note:"Auto-triggered · executed" },
];
