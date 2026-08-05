/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { ArrowLeft, Camera, Plus, Trash2 } from "lucide-react";

import { Btn } from "@/components/ui/Btn";
import { Card } from "@/components/ui/Card";
import { FONT_MONO, T } from "@/theme/tokens";
import { Pill } from "@/components/ui/Pill";
import { Row } from "@/components/ui/Row";

export const WatchlistView = ({ watchlist, onAdd, onRemove, onBack }: any) => (
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
        {watchlist.map(w => (
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
                  {w.ltp > 0 && <> · Now {w.segment === "US" ? "$" : "₹"}{w.ltp}</>}
                </div>
              </div>
              <button onClick={() => onRemove(w.id)}
                className="p-1.5 rounded-md" style={{ background: T.subtle2 }}>
                <Trash2 size={13} color={T.fgMute} />
              </button>
            </div>
          </Row>
        ))}
      </Card>
    )}
  </div>
);
