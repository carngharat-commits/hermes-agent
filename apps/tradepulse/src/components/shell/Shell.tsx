/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { useState } from "react";

import { FONT_BODY, T } from "@/theme/tokens";
import { NAV } from "@/components/shell/nav";
import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";

export const Shell = ({ view, setView, children }: any) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const viewLabel = NAV.find(n => n.k === view)?.l || "";
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: T.bg, color: T.fg, ...FONT_BODY, transition: "background-color 0.7s ease, color 0.7s ease" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
      <style>{`
        .no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{scrollbar-width:none}
        input:focus{outline:none;box-shadow:0 0 0 1px ${T.primary}55 inset}
        button:focus-visible{outline:2px solid ${T.primary}66;outline-offset:2px}
        /* Sunrise/sunset — cards, borders, and text ease through theme change */
        aside, header, main, [class*="rounded"] {
          transition: background-color 0.7s ease, border-color 0.7s ease, color 0.5s ease;
        }
      `}</style>
      <Sidebar view={view} setView={setView} mobileOpen={mobileOpen} closeMobile={() => setMobileOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar viewLabel={viewLabel} toggleMobile={() => setMobileOpen(!mobileOpen)} />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 max-w-[1440px] mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};
