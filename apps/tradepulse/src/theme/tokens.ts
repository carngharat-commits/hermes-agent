/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

export const DARK_TOKENS = {
  bg: "#0a0a0b", card: "#111114", card2: "#17171b", border: "#26262d",
  fg: "#e8e8ea", fgMute: "#8a8a92", fgDim: "#5a5a62",
  primary: "#10b981", primaryHover: "#059669",
  up: "#10b981", down: "#ef4444", warn: "#f59e0b", info: "#3b82f6", violet: "#a855f7",
  sidebarBg: "#0d0d10", sidebarBorder: "#1c1c22",
  overlayBg: "rgba(10,10,11,0.85)",
  subtle: "#ffffff08", subtle2: "#ffffff06",
};

export const LIGHT_TOKENS = {
  bg: "#fafafa", card: "#ffffff", card2: "#f4f4f6", border: "#e4e4e7",
  fg: "#111114", fgMute: "#6b6b72", fgDim: "#a1a1a8",
  primary: "#059669", primaryHover: "#047857",
  up: "#059669", down: "#dc2626", warn: "#d97706", info: "#2563eb", violet: "#7c3aed",
  sidebarBg: "#f4f4f6", sidebarBorder: "#e4e4e7",
  overlayBg: "rgba(250,250,250,0.88)",
  subtle: "#00000008", subtle2: "#00000005",
};

// T is a const object whose PROPERTIES are mutated when theme changes
// (avoids TDZ issues in bundled runtime — Object.assign replaces contents).
export const T = { ...DARK_TOKENS };

export const FONT_BODY = { fontFamily: "'Inter', system-ui, -apple-system, sans-serif" };

export const FONT_MONO = { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontVariantNumeric: "tabular-nums" };
