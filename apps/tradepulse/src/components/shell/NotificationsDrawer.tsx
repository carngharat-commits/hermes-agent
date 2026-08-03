/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { useState } from "react";
import { AlertTriangle, Bell, Calendar, Check, Newspaper, Target, TrendingUp, X } from "lucide-react";

import { Btn } from "@/components/ui/Btn";
import { FONT_MONO, T } from "@/theme/tokens";
import { NOTIFICATIONS } from "@/data/notifications";

export const NotificationsDrawer = ({ onClose }: any) => {
  const [filter, setFilter] = useState("all");
  const unreadCount = NOTIFICATIONS.filter(n => n.unread).length;
  const filtered = NOTIFICATIONS.filter(n =>
    filter === "all" ? true :
    filter === "unread" ? n.unread :
    n.category.toLowerCase() === filter
  );
  const typeIcons = { event:Calendar, price:TrendingUp, execution:Check, signal:Target, news:Newspaper, portfolio:AlertTriangle };
  const typeColors = { event:T.info, price:T.warn, execution:T.up, signal:T.primary, news:T.violet, portfolio:T.warn };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-[520px] mx-auto rounded-t-2xl lg:rounded-2xl lg:mb-8 overflow-hidden flex flex-col"
        style={{ background: T.card, border: `1px solid ${T.border}`, height: "80vh", maxHeight: "640px" }}>

        <div className="flex items-center justify-between px-4 py-3.5 shrink-0" style={{ background: T.card, borderBottom: `1px solid ${T.border}` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${T.primary}18`, border: `1px solid ${T.primary}30` }}>
              <Bell size={14} color={T.primary} />
            </div>
            <div>
              <div className="text-[13px] font-bold">Notifications</div>
              <div className="text-[10.5px]" style={{ color: T.fgMute, ...FONT_MONO }}>{unreadCount} unread · {NOTIFICATIONS.length} total</div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: T.card2 }}>
            <X size={15} color={T.fgMute} />
          </button>
        </div>

        <div className="p-3 shrink-0 flex gap-1 overflow-x-auto no-scrollbar" style={{ borderBottom: `1px solid ${T.border}` }}>
          {[
            { k:"all",       l:"All",       n:NOTIFICATIONS.length },
            { k:"unread",    l:"Unread",    n:unreadCount },
            { k:"event",     l:"Events" },
            { k:"price",     l:"Prices" },
            { k:"signal",    l:"Signals" },
            { k:"news",      l:"News" },
          ].map(o => (
            <button key={o.k} onClick={() => setFilter(o.k)}
              className="px-2.5 py-1 rounded-full text-[10.5px] font-semibold whitespace-nowrap"
              style={{
                background: filter === o.k ? T.fg : "transparent",
                color: filter === o.k ? T.bg : T.fgMute,
                border: `1px solid ${filter === o.k ? T.fg : T.border}`,
                ...FONT_MONO,
              }}>{o.l}{o.n != null ? ` · ${o.n}` : ""}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-[12px]" style={{ color: T.fgMute }}>No notifications match this filter</div>
          ) : filtered.map(n => {
            const Ic = typeIcons[n.type] || Bell;
            const c = typeColors[n.type] || T.info;
            return (
              <div key={n.id} className="flex items-start gap-3 p-3.5" style={{ borderBottom: `1px solid ${T.border}`, background: n.unread ? T.subtle : "transparent" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${c}18`, border: `1px solid ${c}40` }}>
                  <Ic size={13} color={c} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider" style={{ background: `${c}18`, color: c, ...FONT_MONO }}>{n.category}</span>
                    {n.unread && <span className="w-1.5 h-1.5 rounded-full" style={{ background: T.primary }} />}
                    <span className="text-[10px]" style={{ color: T.fgDim, ...FONT_MONO }}>{n.when}</span>
                  </div>
                  <div className="text-[12.5px] font-semibold mt-1.5" style={{ color: T.fg }}>{n.title}</div>
                  <div className="text-[11px] mt-0.5 leading-relaxed" style={{ color: T.fgMute }}>{n.body}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3 shrink-0 flex gap-2" style={{ borderTop: `1px solid ${T.border}` }}>
          <Btn variant="secondary" className="flex-1" onClick={() => alert("All notifications marked read")}>Mark all read</Btn>
          <Btn variant="secondary" className="flex-1" onClick={onClose}>Close</Btn>
        </div>
      </div>
    </div>
  );
};
