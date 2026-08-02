/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { Moon, Sun } from "lucide-react";

import { FONT_MONO, T } from "@/theme/tokens";
import { useThemeMode } from "@/theme/ThemeContext";

export const ThemeToggleButton = () => {
  const { themeMode, setThemeMode, effectiveMode } = useThemeMode();
  const isDark = effectiveMode === "dark";
  const cycle = () => {
    // Cycle: dark -> light -> auto -> dark
    if (themeMode === "dark") setThemeMode("light");
    else if (themeMode === "light") setThemeMode("auto");
    else setThemeMode("dark");
  };
  const gradient = isDark
    ? "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)"
    : "linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%)";
  return (
    <button onClick={cycle}
      title={`Theme: ${themeMode}${themeMode === "auto" ? ` · following OS (${effectiveMode})` : ""}`}
      className="p-1.5 rounded-md relative overflow-hidden"
      style={{
        background: gradient,
        border: `1px solid ${T.border}`,
        transition: "background 0.6s ease",
      }}>
      <div className="relative w-3.5 h-3.5">
        {/* Sun */}
        <div className="absolute inset-0 flex items-center justify-center"
          style={{
            opacity: isDark ? 0 : 1,
            transform: isDark ? "translateY(14px) rotate(-90deg)" : "translateY(0) rotate(0)",
            transition: "transform 0.55s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease",
          }}>
          <Sun size={14} color="#f59e0b" strokeWidth={2.4} />
        </div>
        {/* Moon */}
        <div className="absolute inset-0 flex items-center justify-center"
          style={{
            opacity: isDark ? 1 : 0,
            transform: isDark ? "translateY(0) rotate(0)" : "translateY(-14px) rotate(90deg)",
            transition: "transform 0.55s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease",
          }}>
          <Moon size={13} color="#e2e8f0" strokeWidth={2.4} />
        </div>
      </div>
      {themeMode === "auto" && (
        <span className="absolute -bottom-0.5 -right-0.5 text-[7px] font-bold px-1 rounded"
          style={{ background: T.primary, color: "#000", ...FONT_MONO }}>
          A
        </span>
      )}
    </button>
  );
};
