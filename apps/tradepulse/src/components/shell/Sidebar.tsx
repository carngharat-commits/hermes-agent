/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { Activity } from "lucide-react";

import { FONT_MONO, T } from "@/theme/tokens";
import { NAV, NAV_GROUPS } from "@/components/shell/nav";
import { Pill } from "@/components/ui/Pill";
import { initialsOf, useAuth } from "@/data/auth";

const identity = (status: string, name?: string) =>
  status === "preview" ? { name: "Preview", handle: "no backend" }
  : { name: name ?? "Investor", handle: status === "authenticated" ? "signed in" : "not signed in" };

export const Sidebar = ({ view, setView, mobileOpen, closeMobile }: any) => {
  const { status, user } = useAuth();
  const who = identity(status, user?.name);
  return (
  <>
    {/* Mobile overlay */}
    {mobileOpen && <div className="fixed inset-0 z-30 lg:hidden" style={{ background: "rgba(0,0,0,0.6)" }} onClick={closeMobile} />}

    <aside className={`fixed lg:sticky top-0 left-0 z-40 lg:z-0 h-screen w-[240px] shrink-0 transform transition-transform lg:transform-none
      ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      style={{ background: T.sidebarBg, borderRight: `1px solid ${T.sidebarBorder}` }}>

      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 h-14"
        style={{ borderBottom: `1px solid ${T.sidebarBorder}` }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: T.primary }}>
          <Activity size={15} color="#000" strokeWidth={2.6} />
        </div>
        <div className="font-semibold text-base tracking-tight" style={{ color: T.fg }}>TradePulse</div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto" style={{ height: "calc(100vh - 56px - 72px)" }}>
        {NAV_GROUPS.map(g => (
          <div key={g}>
            <div className="px-2 py-1.5 text-[9.5px] uppercase tracking-[0.15em] font-semibold"
              style={{ color: T.fgDim, ...FONT_MONO }}>{g}</div>
            <div className="space-y-0.5">
              {NAV.filter(n => n.group === g).map(n => {
                const Ic = n.ic;
                const active = view === n.k;
                return (
                  <button key={n.k}
                    onClick={() => { setView(n.k); closeMobile(); }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors"
                    style={{
                      background: active ? `${T.primary}18` : "transparent",
                      color: active ? T.primary : T.fg,
                      border: active ? `1px solid ${T.primary}30` : "1px solid transparent",
                    }}>
                    <Ic size={15} />
                    <span className="text-[12.5px] font-medium flex-1">{n.l}</span>
                    {n.badge && <Pill tone="info" size="xs">{n.badge}</Pill>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="absolute bottom-0 inset-x-0 px-3 py-3" style={{ borderTop: `1px solid ${T.sidebarBorder}` }}>
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg" style={{ background: T.card2 }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold"
            style={{ background: T.primary, color: "#000" }}>{initialsOf(who.name)}</div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold truncate" style={{ color: T.fg }}>{who.name}</div>
            <div className="text-[10px] truncate" style={{ color: T.fgMute, ...FONT_MONO }}>{who.handle}</div>
          </div>
        </div>
      </div>
    </aside>
  </>
  );
};
