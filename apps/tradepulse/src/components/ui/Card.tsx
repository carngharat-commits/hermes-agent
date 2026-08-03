/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { T } from "@/theme/tokens";

export const Card = ({ children, className = "", padded = true, onClick, style }: any) => (
  <div onClick={onClick}
    className={`rounded-xl ${padded ? "p-4" : ""} ${className} ${onClick ? "cursor-pointer active:bg-white/[0.02]" : ""}`}
    style={{ background: T.card, border: `1px solid ${T.border}`, ...style }}>
    {children}
  </div>
);

export const CardHeader = ({ title, subtitle, icon: Icon, right }: any) => (
  <div className="flex items-start justify-between mb-4">
    <div className="flex items-center gap-2.5">
      {Icon && (
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${T.primary}12`, border: `1px solid ${T.primary}30` }}>
          <Icon size={15} color={T.primary} />
        </div>
      )}
      <div>
        <div className="text-[13px] font-semibold" style={{ color: T.fg }}>{title}</div>
        {subtitle && <div className="text-[11px] mt-0.5" style={{ color: T.fgMute }}>{subtitle}</div>}
      </div>
    </div>
    {right}
  </div>
);
