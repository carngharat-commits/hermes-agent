/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { useState } from "react";
import { ArrowUpDown, Check } from "lucide-react";

import { FONT_MONO, T } from "@/theme/tokens";

export const SortMenu = ({ value, onChange }: any) => {
  const [open, setOpen] = useState(false);
  const opts = [
    { k: "weight", l: "By value" },
    { k: "pl",     l: "By P&L (₹)" },
    { k: "plpct",  l: "By P&L (%)" },
    { k: "alpha",  l: "A → Z" },
  ];
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="h-full px-3 py-2 rounded-lg flex items-center gap-1.5"
        style={{ background: T.card2, border: `1px solid ${T.border}` }}>
        <ArrowUpDown size={13} color={T.fgMute} />
        <span className="text-[11.5px]" style={{ color: T.fg, ...FONT_MONO }}>Sort</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-40 rounded-lg overflow-hidden min-w-[150px]"
            style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
            {opts.map(o => (
              <button key={o.k} onClick={() => { onChange(o.k); setOpen(false); }}
                className="w-full px-3 py-2 flex items-center justify-between text-left text-[12px]"
                style={{ background: value === o.k ? T.subtle : "transparent", color: T.fg, borderBottom: `1px solid ${T.border}` }}>
                <span>{o.l}</span>
                {value === o.k && <Check size={12} color={T.primary} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
