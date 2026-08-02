/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { USD_INR } from "@/lib/constants";

export const inr = (n, d = 2) => {
  if (n == null || isNaN(n)) return "—";
  const abs = Math.abs(n);
  return (n < 0 ? "−" : "") + "₹" + abs.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
};

export const inrCompact = (n) => {
  if (n == null || isNaN(n)) return "—";
  const abs = Math.abs(n); const s = n < 0 ? "−" : "";
  if (abs >= 1e7) return `${s}₹${(abs / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${s}₹${(abs / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `${s}₹${(abs / 1e3).toFixed(1)}K`;
  return `${s}₹${abs.toFixed(0)}`;
};

export const usd = (n, d = 2) => (n < 0 ? "−" : "") + "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

export const pct = (n, d = 2) => n == null || isNaN(n) ? "—" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(d)}%`;

export const toINR_us = (u) => u * USD_INR;

export const cvOf = (h) => (h.segment === "IN" || h.segment === "US") ? h.qty * h.ltp : (h.current || 0);

export const ivOf = (h) => (h.segment === "IN" || h.segment === "US") ? h.qty * (h.avg || h.ltp) : (h.invested || 0);

export const cvINR = (h) => h.segment === "US" ? toINR_us(cvOf(h)) : cvOf(h);

export const ivINR = (h) => h.segment === "US" ? toINR_us(ivOf(h)) : ivOf(h);
