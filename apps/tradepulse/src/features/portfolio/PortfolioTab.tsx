/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { Bitcoin, Building2, Camera, ChevronRight, Eye, FlaskConical, Landmark, Link2, PieChart as PieChartIcon, Plus, Sparkles, Trash2 } from "lucide-react";

import { Btn } from "@/components/ui/Btn";
import { Card, CardHeader } from "@/components/ui/Card";
import { FONT_MONO, T } from "@/theme/tokens";
import { KV } from "@/components/ui/KV";
import { SourceBadge } from "@/components/ui/SourceBadge";
import { cvINR, inrCompact, ivINR, pct, toINR_us } from "@/lib/format";

export const PortfolioTab = ({
  holdings, watchlist, onOpenSegment, onOpenWatchlist, onAdd, source = "snapshot",
  onLoadDemo, onClearDemo, onConnect,
}: any) => {
  const segs = ["IN", "US", "MF", "PM", "CR"].map(k => {
    const list = holdings.filter(h => h.segment === k);
    const cv = list.reduce((s, h) => s + cvINR(h), 0);
    const iv = list.reduce((s, h) => s + ivINR(h), 0);
    const pl = cv - iv;
    const plPct = iv > 0 ? (pl / iv) * 100 : 0;
    return { k, n: list.length, cv, iv, pl, plPct };
  });
  const total = segs.reduce((s, x) => s + x.cv, 0);
  const totalIV = segs.reduce((s, x) => s + x.iv, 0);
  const totalPL = total - totalIV;
  const totalPct = totalIV > 0 ? (totalPL / totalIV) * 100 : 0;
  const dayChg = holdings.reduce((s, h) => {
    const v = h.segment === "IN" ? h.qty * h.ltp * (h.dayPct || 0) / 100
            : h.segment === "US" ? toINR_us(h.qty * h.ltp) * (h.dayPct || 0) / 100
            : (h.current || 0) * (h.dayPct || 0) / 100;
    return s + v;
  }, 0);

  const segColor = { IN: T.info, US: "#22d3ee", MF: T.violet, PM: "#fbbf24", CR: T.warn };
  const segLabel = { IN: "Indian Equities", US: "US Equities", MF: "Mutual Funds", PM: "Precious Metals", CR: "Crypto" };
  const segIcon  = { IN: Building2, US: Landmark, MF: PieChartIcon, PM: Sparkles, CR: Bitcoin };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-bold tracking-tight">Portfolio Tracking</h1>
            <SourceBadge source={source} />
          </div>
          <div className="text-[12px] mt-1" style={{ color: T.fgMute }}>
            {holdings.length} holdings across 6 accounts · {inrCompact(total)} net worth
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(source === "demo" || source === "mixed") && onClearDemo && (
            <Btn variant="ghost" size="sm" onClick={onClearDemo} title="Remove the sample holdings">
              <Trash2 size={12} /> Clear demo
            </Btn>
          )}
          {/* With rows of your own and no demo, the empty-state card is gone;
              the demo must still be reachable to lay alongside them. */}
          {source === "manual" && onLoadDemo && (
            <Btn variant="ghost" size="sm" onClick={onLoadDemo} title="Add the sample holdings alongside yours">
              <FlaskConical size={12} /> Load demo book
            </Btn>
          )}
          <Btn onClick={onAdd}><Plus size={14} /> Add Position</Btn>
        </div>
      </div>

      {/* First run. The book starts empty on purpose: this app must never
          present someone else's holdings as yours. Three ways in. */}
      {holdings.length === 0 && (
        <Card>
          <div className="flex flex-col items-center text-center py-6">
            <div className="text-[15px] font-semibold">Your book is empty</div>
            <div className="text-[11.5px] mt-1 max-w-[360px]" style={{ color: T.fgMute }}>
              Nothing here is pre-filled. Add a position you own, connect your broker,
              or load a sample book to see every screen with data on it.
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
              <Btn onClick={onAdd}><Plus size={13} /> Add a position</Btn>
              {onConnect && <Btn variant="ghost" onClick={onConnect}><Link2 size={13} /> Connect Zerodha</Btn>}
              {onLoadDemo && <Btn variant="ghost" onClick={onLoadDemo}><FlaskConical size={13} /> Load demo book</Btn>}
            </div>
            <div className="text-[10px] mt-3" style={{ color: T.fgDim }}>
              The demo book is clearly labelled and can be cleared at any time.
            </div>
          </div>
        </Card>
      )}

      {/* Portfolio summary */}
      <Card>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KV k="Net worth"       v={inrCompact(total)} />
          <KV k="Invested"        v={inrCompact(totalIV)} />
          <KV k="Unrealised P&L"  v={inrCompact(totalPL)} tone={totalPL >= 0 ? "up" : "down"} sub={pct(totalPct, 2)} />
          <KV k="Day P&L"         v={inrCompact(dayChg)} tone={dayChg >= 0 ? "up" : "down"} />
        </div>
      </Card>

      {/* Segments */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {segs.map(s => {
          const Ic = segIcon[s.k];
          const share = total > 0 ? (s.cv / total) * 100 : 0;
          return (
            <Card key={s.k} onClick={() => onOpenSegment(s.k)}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${segColor[s.k]}14`, border: `1px solid ${segColor[s.k]}30` }}>
                  <Ic size={17} color={segColor[s.k]} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="text-[13.5px] font-semibold">{segLabel[s.k]}</div>
                    <div className="text-[14px] font-bold" style={FONT_MONO}>{inrCompact(s.cv)}</div>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="text-[11px]" style={{ color: T.fgMute, ...FONT_MONO }}>
                      {s.n} holdings · {share.toFixed(1)}%
                    </div>
                    <div className="text-[11px] font-semibold" style={{ color: s.pl >= 0 ? T.up : T.down, ...FONT_MONO }}>
                      {inrCompact(s.pl)} · {pct(s.plPct, 2)}
                    </div>
                  </div>
                  <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: T.subtle }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, share)}%`, background: segColor[s.k] }} />
                  </div>
                </div>
                <ChevronRight size={16} color={T.fgDim} />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Watchlist teaser */}
      <Card>
        <CardHeader title="Watchlist" subtitle={`${watchlist.length} tracked · not owned`} icon={Eye}
          right={<Btn variant="ghost" size="sm" onClick={onOpenWatchlist}>Manage <ChevronRight size={11} /></Btn>} />
        {watchlist.length === 0 ? (
          <div className="flex items-center gap-3 p-4 rounded-lg" style={{ background: T.card2, border: `1px dashed ${T.border}` }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: T.subtle }}>
              <Camera size={16} color={T.fgMute} />
            </div>
            <div className="flex-1">
              <div className="text-[12.5px] font-semibold">Add scripts by photo + rate</div>
              <div className="text-[11px]" style={{ color: T.fgMute }}>Snap a chart, enter target rate + qty, keep an eye on entries.</div>
            </div>
            <Btn size="sm" onClick={onAdd}>Add</Btn>
          </div>
        ) : (
          <div className="space-y-1.5">
            {watchlist.slice(0, 4).map(w => (
              <div key={w.id} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: T.card2 }}>
                {w.photo && <img src={w.photo} className="w-8 h-8 rounded object-cover" style={{ border: `1px solid ${T.border}` }} />}
                <div className="flex-1">
                  <div className="text-[12px] font-semibold" style={FONT_MONO}>{w.sym}</div>
                  <div className="text-[10.5px]" style={{ color: T.fgMute, ...FONT_MONO }}>
                    Qty {w.qty} · Target {w.segment === "US" ? "$" : "₹"}{w.target}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
