/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { T } from "@/theme/tokens";

export const Btn = ({ children, variant = "primary", size = "md", onClick, disabled, className = "" }: any) => {
  const styles = {
    primary:   { bg: T.primary,     fg: "#000",     hover: T.primaryHover },
    secondary: { bg: T.card2,       fg: T.fg,       hover: "#22222a" },
    ghost:     { bg: "transparent", fg: T.fg,       hover: T.subtle },
    danger:    { bg: `${T.down}18`, fg: T.down,     hover: `${T.down}28` },
  }[variant];
  const sz = size === "sm" ? "px-3 py-1.5 text-[11.5px]" : size === "lg" ? "px-5 py-3 text-[13px]" : "px-4 py-2 text-[12px]";
  return (
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors disabled:opacity-40 ${sz} ${className}`}
      style={{ background: styles.bg, color: styles.fg, border: variant === "secondary" ? `1px solid ${T.border}` : "none" }}>
      {children}
    </button>
  );
};
