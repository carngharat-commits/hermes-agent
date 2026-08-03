/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { useState } from "react";
import { ArrowLeft, Check, ChevronRight, X } from "lucide-react";

import { Btn } from "@/components/ui/Btn";
import { FONT_MONO, T } from "@/theme/tokens";
import { Input, Label } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";

export const PlaceOrderSheet = ({ onClose }: any) => {
  const [step, setStep] = useState(1);
  const [side, setSide] = useState("BUY");
  const [type, setType] = useState("CNC");
  const [sym, setSym] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [trigger, setTrigger] = useState("");
  const [broker, setBroker] = useState("Zerodha");

  const canProceed = sym.trim() && qty && price && (type !== "GTT" || trigger);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-[520px] mx-auto rounded-t-2xl lg:rounded-2xl lg:mb-8 overflow-hidden flex flex-col"
        style={{ background: T.card, border: `1px solid ${T.border}`, maxHeight: "92vh" }}>

        <div className="flex items-center justify-between px-4 py-3.5 sticky top-0 z-10"
          style={{ background: T.card, borderBottom: `1px solid ${T.border}` }}>
          <div>
            <div className="text-[14px] font-bold">New Order Idea</div>
            <div className="text-[10.5px]" style={{ color: T.fgMute, ...FONT_MONO }}>Step {step} of 2</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: T.card2 }}>
            <X size={15} color={T.fgMute} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4">
          {step === 1 ? (
            <>
              <div>
                <Label>Side</Label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {["BUY", "SELL"].map(s => (
                    <button key={s} onClick={() => setSide(s)}
                      className="py-2.5 rounded-lg text-[13px] font-bold"
                      style={{
                        background: side === s ? (s === "BUY" ? T.up : T.down) : T.card2,
                        color: side === s ? "#000" : T.fgMute,
                        border: `1px solid ${side === s ? (s === "BUY" ? T.up : T.down) : T.border}`,
                        ...FONT_MONO,
                      }}>{s}</button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Order type</Label>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {[
                    { k:"CNC", l:"CNC", sub:"Delivery" },
                    { k:"MIS", l:"MIS", sub:"Intraday" },
                    { k:"GTT", l:"GTT", sub:"Trigger" },
                  ].map(o => (
                    <button key={o.k} onClick={() => setType(o.k)}
                      className="py-2 rounded-lg text-center"
                      style={{
                        background: type === o.k ? `${T.primary}18` : T.card2,
                        color: type === o.k ? T.primary : T.fgMute,
                        border: `1px solid ${type === o.k ? T.primary : T.border}`,
                      }}>
                      <div className="text-[12.5px] font-bold" style={FONT_MONO}>{o.l}</div>
                      <div className="text-[9.5px] mt-0.5">{o.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Broker</Label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {["Zerodha", "ABML", "INDmoney"].map(b => (
                    <button key={b} onClick={() => setBroker(b)}
                      className="px-3 py-1.5 rounded-full text-[11px] font-semibold"
                      style={{
                        background: broker === b ? T.fg : T.card2,
                        color: broker === b ? T.bg : T.fgMute,
                        border: `1px solid ${broker === b ? T.fg : T.border}`,
                        ...FONT_MONO,
                      }}>{b}</button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Symbol</Label>
                <Input value={sym} onChange={setSym} placeholder="e.g. RELIANCE" upper />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><Label>Qty</Label><Input value={qty} onChange={setQty} placeholder="0" numeric /></div>
                <div><Label>Limit price ₹</Label><Input value={price} onChange={setPrice} placeholder="0.00" numeric /></div>
              </div>

              {type === "GTT" && (
                <div>
                  <Label>Trigger price ₹</Label>
                  <Input value={trigger} onChange={setTrigger} placeholder="0.00" numeric />
                </div>
              )}

              <Btn onClick={() => setStep(2)} disabled={!canProceed} className="w-full" size="lg">
                Review order <ChevronRight size={13} />
              </Btn>
            </>
          ) : (
            <>
              <div className="p-3 rounded-lg space-y-2" style={{ background: T.card2, border: `1px solid ${T.border}` }}>
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] uppercase tracking-widest font-semibold" style={{ color: T.fgMute, ...FONT_MONO }}>Order</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded"
                      style={{ background: `${side === "BUY" ? T.up : T.down}18`, color: side === "BUY" ? T.up : T.down, ...FONT_MONO }}>
                      {side}
                    </span>
                    <Pill tone="neutral" size="xs">{type}</Pill>
                  </div>
                </div>
                <div className="text-[18px] font-bold" style={FONT_MONO}>{sym.toUpperCase()}</div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <div className="text-[9.5px] uppercase tracking-widest font-semibold" style={{ color: T.fgMute, ...FONT_MONO }}>Quantity</div>
                    <div className="text-[13px] font-semibold" style={FONT_MONO}>{qty}</div>
                  </div>
                  <div>
                    <div className="text-[9.5px] uppercase tracking-widest font-semibold" style={{ color: T.fgMute, ...FONT_MONO }}>Limit</div>
                    <div className="text-[13px] font-semibold" style={FONT_MONO}>₹{price}</div>
                  </div>
                  <div>
                    <div className="text-[9.5px] uppercase tracking-widest font-semibold" style={{ color: T.fgMute, ...FONT_MONO }}>Broker</div>
                    <div className="text-[13px] font-semibold">{broker}</div>
                  </div>
                  {type === "GTT" && (
                    <div>
                      <div className="text-[9.5px] uppercase tracking-widest font-semibold" style={{ color: T.fgMute, ...FONT_MONO }}>Trigger</div>
                      <div className="text-[13px] font-semibold" style={FONT_MONO}>₹{trigger}</div>
                    </div>
                  )}
                </div>
                <div className="text-[11px] pt-2 mt-2" style={{ color: T.fgMute, borderTop: `1px solid ${T.border}` }}>
                  Est. value <span className="font-semibold" style={{ color: T.fg }}>₹{(parseFloat(qty) * parseFloat(price)).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg text-[11px] leading-relaxed" style={{ background: `${T.warn}10`, border: `1px solid ${T.warn}30`, color: T.fg }}>
                <span className="font-semibold" style={{ color: T.warn }}>⚠ This does not route the order.</span> Confirming saves the intent to TradePulse. Execute in the {broker} app.
              </div>

              <div className="flex gap-2">
                <Btn variant="secondary" onClick={() => setStep(1)} className="flex-1"><ArrowLeft size={13} /> Back</Btn>
                <Btn onClick={() => { alert(`Order intent saved: ${side} ${qty} ${sym.toUpperCase()} @ ₹${price} · ${broker}`); onClose(); }} className="flex-1" size="lg">
                  <Check size={13} /> Confirm & Save
                </Btn>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
