/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { createContext, useContext } from "react";

// Context for theme mode + setter (consumed by TopBar toggle + Settings)
export type ThemeContextValue = {
  themeMode: string;
  setThemeMode: (mode: string) => void;
  effectiveMode: string;
};

export const ThemeContext = createContext<ThemeContextValue>({ themeMode: "dark", setThemeMode: () => {}, effectiveMode: "dark" });

export const useThemeMode = () => useContext(ThemeContext);
