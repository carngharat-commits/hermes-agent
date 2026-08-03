/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

export const NOTIFICATIONS = [
  { id:1, type:"event",     title:"RBI MPC decision · Fri Aug 6",   body:"10:00 IST · Repo rate expected hold at 6.25% · Watch guidance for Oct pivot signals",       when:"2h ago",  unread:true,  category:"Event" },
  { id:2, type:"price",     title:"LLOYDSME approaching target",     body:"₹2,051.30 → ₹2,400 target (17% away) · Consider partial book on any spike",              when:"25m ago", unread:true,  category:"Price" },
  { id:3, type:"execution", title:"MRPL GTT triggered · executed",   body:"Sold 100 @ ₹195.00 · Realised gain ₹1,590 (+5.8%)",                                       when:"1h ago",  unread:true,  category:"Trade" },
  { id:4, type:"signal",    title:"IRCTC — CUT signal refreshed",    body:"Fresh conviction 78/100 · Tax-loss harvest saves ₹1,908 STCG offset",                   when:"3h ago",  unread:false, category:"Signal" },
  { id:5, type:"news",      title:"Fed dovish tilt confirmed",        body:"Sep cut odds jumped to 82% · Growth stocks in your US book benefit",                    when:"4h ago",  unread:false, category:"News" },
  { id:6, type:"news",      title:"Crude WTI at $71 · Refiners bid", body:"HPCL & MRPL setups strengthening on margin expansion outlook",                          when:"6h ago",  unread:false, category:"News" },
  { id:7, type:"portfolio", title:"CHOLAFIN in Overweight Alert",     body:"+₹1,631 (+29%) · Consider trimming 25% if breaks ₹1,900",                              when:"1d ago",  unread:false, category:"Alert" },
];
