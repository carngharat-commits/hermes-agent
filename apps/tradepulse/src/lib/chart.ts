/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { pct } from "@/lib/format";

// Seeded chart data generator — deterministic per symbol so bars stay stable across renders
export const _chartSeed = (sym) => sym.split("").reduce((s, c) => s + c.charCodeAt(0), 0);

export const _chartRand = (seed) => { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };

export const genChartData = (sym, ltp, tf) => {
  const points = { "1D":78, "5D":50, "1M":22, "3M":66, "6M":126, "1Y":252 }[tf] || 66;
  const days = { "1D":1, "5D":5, "1M":30, "3M":90, "6M":180, "1Y":365 }[tf] || 90;
  const vol = { "1D":0.005, "5D":0.008, "1M":0.012, "3M":0.020, "6M":0.028, "1Y":0.040 }[tf] || 0.020;
  const rand = _chartRand(_chartSeed(sym) + points);

  const data = new Array(points);
  const baseline = ltp * (0.70 + rand() * 0.20); // start 70-90% of current
  const trend = (ltp - baseline) / points;
  const avgVolume = 100000 + Math.floor(rand() * 900000);

  const today = new Date("2026-07-31");
  let price = baseline;
  let prevPrice = baseline;

  for (let i = 0; i < points; i++) {
    prevPrice = price;
    const noise = (rand() - 0.5) * ltp * vol;
    price = Math.max(ltp * 0.5, price + trend + noise);

    // Volume: higher on bigger price moves + occasional spikes
    const priceMove = Math.abs(price - prevPrice) / ltp;
    const spike = rand() < 0.08 ? 1.5 + rand() * 2 : 1;
    const volume = Math.round(avgVolume * (0.5 + rand() * 0.7 + priceMove * 25) * spike);

    const daysAgo = Math.round(days * (1 - i / (points - 1)));
    const d = new Date(today);
    d.setDate(today.getDate() - daysAgo);

    data[i] = {
      i,
      date: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      price: +price.toFixed(2),
      volume,
      up: price >= prevPrice,
    };
  }
  data[points - 1].price = ltp; // anchor to current LTP

  // Compute moving averages
  const ma = (n) => data.map((_, i) => {
    if (i < n - 1) return null;
    let sum = 0;
    for (let k = i - n + 1; k <= i; k++) sum += data[k].price;
    return +(sum / n).toFixed(2);
  });
  const ma20 = ma(Math.min(20, Math.floor(points / 3)));
  const ma50 = ma(Math.min(50, Math.floor(points / 2)));
  data.forEach((d, i) => { d.ma20 = ma20[i]; d.ma50 = ma50[i]; });

  return { data, avgVolume };
};

export const analyzeVolume = (chartData, ltp) => {
  const { data, avgVolume } = chartData;
  const recent = data.slice(-10);
  const latestVol = recent[recent.length - 1].volume;
  const recentAvgVol = recent.reduce((s, d) => s + d.volume, 0) / recent.length;
  const priceStart = recent[0].price;
  const priceEnd = recent[recent.length - 1].price;
  const priceChg = ((priceEnd - priceStart) / priceStart) * 100;
  const volRatio = latestVol / avgVolume;

  const volTrend = recentAvgVol > avgVolume * 1.15 ? "rising"
                 : recentAvgVol < avgVolume * 0.85 ? "declining"
                 : "steady";

  let signal, tone, verdict, action;
  if (priceChg > 2 && volRatio > 1.5) {
    signal = "Strong buying"; tone = "up";
    verdict = `Price ${pct(priceChg, 1)} on ${volRatio.toFixed(1)}× avg volume — institutional buying visible.`;
    action = "Bullish confirmation. Look for follow-through above recent highs. Volume-backed moves have higher probability of continuation.";
  } else if (priceChg < -2 && volRatio > 1.5) {
    signal = "Strong selling"; tone = "down";
    verdict = `Price ${pct(priceChg, 1)} on ${volRatio.toFixed(1)}× avg volume — distribution / institutional exit.`;
    action = "Bearish confirmation. Consider trimming or exiting. Volume-heavy declines rarely reverse quickly.";
  } else if (priceChg > 2 && volRatio < 0.8) {
    signal = "Weak rally"; tone = "warn";
    verdict = `Price up ${pct(priceChg, 1)} but volume ${volRatio.toFixed(1)}× avg — thin buying, risk of reversal.`;
    action = "Don't chase. Wait for volume confirmation or a pullback before committing capital.";
  } else if (priceChg < -2 && volRatio < 0.8) {
    signal = "Weak selling"; tone = "warn";
    verdict = `Price down ${pct(priceChg, 1)} on thin volume ${volRatio.toFixed(1)}× avg — possible dip-buying opportunity.`;
    action = "Sellers exhausted or absent. Watch for reversal signals in next 2-3 sessions.";
  } else if (volTrend === "declining" && Math.abs(priceChg) < 1) {
    signal = "Consolidation"; tone = "info";
    verdict = `Sideways price with declining volume — market waiting for catalyst.`;
    action = "Wait for a volume-backed breakout in either direction before positioning.";
  } else {
    signal = "Neutral"; tone = "info";
    verdict = `Price ${pct(priceChg, 1)} on ${volRatio.toFixed(1)}× avg volume — no strong signal.`;
    action = "No high-conviction volume signal. Watch for pattern development.";
  }

  return { signal, tone, verdict, action, volRatio, volTrend, priceChg, latestVol, recentAvgVol };
};
