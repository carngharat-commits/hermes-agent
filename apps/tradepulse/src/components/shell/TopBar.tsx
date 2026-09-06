/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { useState } from "react";
import { Bell, Menu } from "lucide-react";

import { FONT_MONO, T } from "@/theme/tokens";
import { MarketTicker } from "@/components/shell/MarketTicker";
import { NotificationsDrawer } from "@/components/shell/NotificationsDrawer";
import { ThemeToggleButton } from "@/components/shell/ThemeToggleButton";

export const TopBar = ({ toggleMobile, viewLabel }: any) => {
  const [notifOpen, setNotifOpen] = useState(false);
  return (
    <>
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 lg:px-6 h-14 backdrop-blur"
        style={{ background: T.overlayBg, borderBottom: `1px solid ${T.border}` }}>
        <div className="flex items-center gap-3">
          <button className="lg:hidden p-1.5 rounded-md" onClick={toggleMobile} style={{ background: T.card2 }} aria-label="Open menu">
            <Menu size={16} color={T.fg} />
          </button>
          <div>
            <div className="text-[13px] font-semibold" style={{ color: T.fg }}>{viewLabel}</div>
            <div className="text-[10.5px]" style={{ color: T.fgMute, ...FONT_MONO }}>
              <span style={{ color: T.up }}>●</span> Live · NSE + BSE
            </div>
          </div>
        </div>
        <MarketTicker />
        <div className="flex items-center gap-2">
          <ThemeToggleButton />
          <button
            onClick={() => setNotifOpen(true)}
            className="p-1.5 rounded-md relative" style={{ background: T.card2, border: `1px solid ${T.border}` }}>
            <Bell size={14} color={T.fg} />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ background: T.down }} />
          </button>
        </div>
      </header>
      {notifOpen && <NotificationsDrawer onClose={() => setNotifOpen(false)} />}
    </>
  );
};
