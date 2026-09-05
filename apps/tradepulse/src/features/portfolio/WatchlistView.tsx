/* Lifted from the original single-file TradePulse artifact. The intelligence
   strip and its data hook are the only additions; the layout is unchanged. */

import { ArrowLeft, Camera, Plus, Trash2 } from "lucide-react";

import { Btn } from "@/components/ui/Btn";
import { Card } from "@/components/ui/Card";
import { FONT_MONO, T } from "@/theme/tokens";
import { Pill } from "@/components/ui/Pill";
import { Row } from "@/components/ui/Row";
import { ValuationStrip } from "@/components/ui/ValuationStrip";
import { useIntel } from "@/data/useIntel";
import { useQuotes } from "@/data/useQuotes";

export const WatchlistView = ({ watchlist, onAdd, onRemove, onBack }: any) => {
  // Only rows carrying a price the user actually observed get valued.
  //
  // A watchlist entry saved with just a target still gets an `ltp` — the add
  // sheet backfills it from the target so the row renders. Valuing against
  // that would compare intrinsic value to what the user *hopes* to pay and
  // present the gap as a discount to market, which is a fabricated number.
  // `ltpEntered` is the flag that separates the two.
  const typedPrice = (w: any) => Number(w.ltp) > 0 && w.ltpEntered !== false;

  // Quotes for every row. A live quote (kite, http) is a market price and
  // feeds the valuation; a stub quote is shown, labelled, and feeds nothing
  // — a discount computed against a pretend price is a fabricated number.
  const quotes = useQuotes(watchlist.map((w: any) => w.sym));
  const quoteFor = (w: any) => quotes.bySymbol[String(w.sym).toUpperCase()];
  const liveQuote = (w: any) => { const q = quoteFor(w); return q && q.source !== "stub" ? q : undefined; };
  const priced = (w: any) => liveQuote(w) ? { ...w, ltp: liveQuote(w)!.price } : typedPrice(w) ? w : null;
  const hasMarketPrice = (w: any) => priced(w) !== null;
  const { bySymbol } = useIntel(watchlist.map(priced).filter(Boolean));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-md" style={{ background: T.card2, border: `1px solid ${T.border}` }}>
          <ArrowLeft size={14} color={T.fg} />
        </button>
        <div className="flex-1">
          <div className="text-[19px] font-bold tracking-tight">Watchlist</div>
          <div className="text-[11px] mt-0.5" style={{ color: T.fgMute }}>Tracked scripts · not owned yet</div>
        </div>
        <Btn onClick={onAdd}><Plus size={14} /> Add</Btn>
      </div>

      {watchlist.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center text-center py-8">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
              style={{ background: `${T.primary}18`, border: `1px solid ${T.primary}30` }}>
              <Camera size={22} color={T.primary} />
            </div>
            <div className="text-[14px] font-semibold">Add your first script</div>
            <div className="text-[11.5px] mt-1 max-w-[280px]" style={{ color: T.fgMute }}>
              Take a photo of the chart / news, note quantity you're eyeing, and target entry price.
            </div>
            <Btn onClick={onAdd} className="mt-4"><Camera size={13} /> Add via photo</Btn>
          </div>
        </Card>
      ) : (
        <Card padded={false}>
          {watchlist.map((w: any) => {
            // Looked up per row, not per symbol. `bySymbol` is keyed by ticker,
            // so a watchlist holding the same name twice — one priced, one
            // target-only — would otherwise hand the unpriced row the priced
            // row's valuation and show a discount it never asked for.
            const intel = hasMarketPrice(w) ? bySymbol[w.sym] : undefined;
            // How the target compares to intrinsic value — the question a
            // watchlist actually asks, and one the holdings view never has to.
            const intrinsic = intel?.valuation?.intrinsic_value;
            const target = Number(w.target) || 0;
            const targetGap = intrinsic && target > 0
              ? (intrinsic - target) / intrinsic
              : null;

            return (
              <Row key={w.id}>
                <div className="flex items-start gap-3">
                  {w.photo && <img src={w.photo} className="w-12 h-12 rounded-lg object-cover shrink-0" style={{ border: `1px solid ${T.border}` }} />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[13.5px] font-bold" style={FONT_MONO}>{w.sym}</span>
                      <Pill tone="info" size="xs">{w.segment}</Pill>
                      {w.note && <span className="text-[10px]" style={{ color: T.fgDim }}>· {w.note}</span>}
                    </div>
                    <div className="text-[10.5px] mt-0.5" style={{ color: T.fgMute, ...FONT_MONO }}>
                      {/* Quantity is optional on a watchlist — you don't own it. */}
                      {w.qty > 0 && <>Qty {w.qty} · </>}
                      Target {w.segment === "US" ? "$" : "₹"}{w.target}
                      {(() => {
                        const q = quoteFor(w);
                        const cur = w.segment === "US" ? "$" : "₹";
                        if (q && q.source !== "stub") return <> · Now {cur}{q.price}{q.day_pct != null && <span style={{ color: q.day_pct >= 0 ? T.up : T.down }}> ({q.day_pct >= 0 ? "+" : ""}{q.day_pct}%)</span>}</>;
                        if (typedPrice(w)) return <> · Now {cur}{w.ltp}</>;
                        if (q) return <> · Now {cur}{q.price} <Pill tone="warn" size="xs">stub quote</Pill></>;
                        return null;
                      })()}
                    </div>

                    <ValuationStrip row={intel} />

                    {targetGap !== null && (
                      <div className="mt-1.5 text-[10px]" style={{ color: T.fgDim, ...FONT_MONO }}>
                        your target is{" "}
                        <span style={{ color: targetGap > 0 ? T.up : T.warn }}>
                          {targetGap > 0
                            ? `${(targetGap * 100).toFixed(0)}% below intrinsic`
                            : `${Math.abs(targetGap * 100).toFixed(0)}% above intrinsic`}
                        </span>
                      </div>
                    )}
                  </div>
                  <button onClick={() => onRemove(w.id)}
                    className="p-1.5 rounded-md" style={{ background: T.subtle2 }}>
                    <Trash2 size={13} color={T.fgMute} />
                  </button>
                </div>
              </Row>
            );
          })}
        </Card>
      )}
    </div>
  );
};
