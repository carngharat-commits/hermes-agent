/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { T } from "@/theme/tokens";

export const Row = ({ children, onClick, className = "" }: any) => (
  <div onClick={onClick}
    className={`px-4 py-3.5 ${onClick ? "active:bg-white/[0.02] cursor-pointer" : ""} ${className}`}
    style={{ borderBottom: `1px solid ${T.border}` }}>{children}
  </div>
);
