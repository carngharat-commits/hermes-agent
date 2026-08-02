/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { Info } from "lucide-react";

import { FONT_MONO, T } from "@/theme/tokens";

export const DemoBadge = ({ note, label = "Demo" }: any) => (
  <button
    onClick={() => alert(`${label} data notice\n\n${note}`)}
    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-semibold whitespace-nowrap"
    style={{ background: `${T.warn}18`, color: T.warn, border: `1px solid ${T.warn}40`, ...FONT_MONO }}
    title="Tap for source note">
    <Info size={9} /> {label}
  </button>
);
