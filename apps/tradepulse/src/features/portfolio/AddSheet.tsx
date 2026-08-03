/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { useState, useRef } from "react";
import { Camera, Check, Image as ImageIcon, RefreshCw, X } from "lucide-react";

import { Btn } from "@/components/ui/Btn";
import { FONT_MONO, T } from "@/theme/tokens";
import { Input, Label } from "@/components/ui/Field";

const BROKERS_BY_SEGMENT = {
  IN: ["Zerodha", "ABML", "Groww", "Other"],
  US: ["INDmoney", "Vested", "Other"],
  MF: ["Groww", "INDmoney", "MFCentral", "Other"],
  PM: ["PhonePe", "Google Pay", "Paytm", "SafeGold", "MMTC-PAMP", "Other"],
  CR: ["CoinDCX", "WazirX", "Binance", "Other"],
};

export const AddSheet = ({ onClose, onSave, defaultMode = "watchlist" }: any) => {
  const [mode, setMode] = useState(defaultMode);
  const [segment, setSegment] = useState("IN");
  const [broker, setBroker] = useState(BROKERS_BY_SEGMENT.IN[0]);
  const [sym, setSym] = useState("");
  const [qty, setQty] = useState("");
  const [avg, setAvg] = useState("");
  const [target, setTarget] = useState("");
  const [ltp, setLtp] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState(null);
  const [parsing, setParsing] = useState(false);
  const fileRef = useRef(null);

  const brokers = BROKERS_BY_SEGMENT;

  const handleFile = (file) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      setPhoto(r.result);
      setParsing(true);
      setTimeout(() => setParsing(false), 900);
    };
    r.readAsDataURL(file);
  };

  const canSave = sym.trim() && qty && (mode === "holding" ? avg : target);
  const submit = () => {
    if (!canSave) return;
    onSave({
      id: `${Date.now()}`, mode, segment, broker,
      sym: sym.trim().toUpperCase(), qty: parseFloat(qty),
      avg: parseFloat(avg || ltp || target),
      target: parseFloat(target || ltp || avg),
      ltp: parseFloat(ltp || target || avg),
      note: note.trim(), photo,
    });
  };

  const cur = segment === "US" ? "$" : "₹";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-[520px] mx-auto rounded-t-2xl lg:rounded-2xl lg:mb-8 overflow-hidden flex flex-col"
        style={{ background: T.card, border: `1px solid ${T.border}`, maxHeight: "92vh" }}>
        <div className="flex items-center justify-between px-4 py-3.5 sticky top-0 z-10"
          style={{ background: T.card, borderBottom: `1px solid ${T.border}` }}>
          <div className="text-[14px] font-bold">Add {mode === "holding" ? "Holding" : "to Watchlist"}</div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: T.card2 }}><X size={15} color={T.fgMute} /></button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: T.card2 }}>
            {[{ k: "watchlist", l: "Watchlist" }, { k: "holding", l: "Owned" }].map(o => (
              <button key={o.k} onClick={() => setMode(o.k)}
                className="flex-1 py-2 rounded-md text-[11.5px] font-semibold"
                style={{
                  background: mode === o.k ? T.fg : "transparent",
                  color: mode === o.k ? T.bg : T.fgMute, ...FONT_MONO,
                }}>{o.l}</button>
            ))}
          </div>

          {/* Photo */}
          <div>
            <Label>Photo · optional but recommended</Label>
            {photo ? (
              <div className="mt-1.5 relative">
                <img src={photo} className="w-full max-h-[220px] object-cover rounded-lg" style={{ border: `1px solid ${T.border}` }} />
                <button onClick={() => setPhoto(null)}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(0,0,0,0.75)", border: `1px solid ${T.border}` }}>
                  <X size={14} color="#fff" /></button>
                {parsing && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg" style={{ background: "rgba(10,10,11,0.7)" }}>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                      <RefreshCw size={12} color={T.primary} className="animate-spin" />
                      <span className="text-[11px]" style={{ color: T.fg, ...FONT_MONO }}>Reading photo...</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <button onClick={() => fileRef.current?.click()}
                  className="py-4 rounded-lg flex flex-col items-center gap-1.5"
                  style={{ background: T.card2, border: `1px dashed ${T.border}` }}>
                  <Camera size={18} color={T.primary} />
                  <span className="text-[11px]" style={{ color: T.fg, ...FONT_MONO }}>Take / Choose</span>
                </button>
                <button onClick={() => fileRef.current?.click()}
                  className="py-4 rounded-lg flex flex-col items-center gap-1.5"
                  style={{ background: T.card2, border: `1px dashed ${T.border}` }}>
                  <ImageIcon size={18} color={T.primary} />
                  <span className="text-[11px]" style={{ color: T.fg, ...FONT_MONO }}>From gallery</span>
                </button>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" capture="environment"
              onChange={e => handleFile(e.target.files?.[0])} className="hidden" />
          </div>

          {/* Segment */}
          <div>
            <Label>Segment</Label>
            <div className="mt-1.5 grid grid-cols-5 gap-1.5">
              {[{ k: "IN", l: "IN Eq" }, { k: "US", l: "US Eq" }, { k: "MF", l: "MF" }, { k: "PM", l: "Metals" }, { k: "CR", l: "Crypto" }].map(o => (
                <button key={o.k} onClick={() => { setSegment(o.k); setBroker(brokers[o.k][0]); }}
                  className="py-2 rounded-lg text-[11.5px] font-semibold"
                  style={{
                    background: segment === o.k ? T.primary : T.card2,
                    color: segment === o.k ? "#000" : T.fgMute,
                    border: `1px solid ${segment === o.k ? T.primary : T.border}`, ...FONT_MONO,
                  }}>{o.l}</button>
              ))}
            </div>
          </div>

          {/* Broker */}
          <div>
            <Label>Broker / Exchange</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {brokers[segment].map(b => (
                <button key={b} onClick={() => setBroker(b)}
                  className="px-3 py-1.5 rounded-full text-[11px] font-semibold"
                  style={{
                    background: broker === b ? T.fg : T.card2,
                    color: broker === b ? T.bg : T.fgMute,
                    border: `1px solid ${broker === b ? T.fg : T.border}`, ...FONT_MONO,
                  }}>{b}</button>
              ))}
            </div>
          </div>

          <div>
            <Label>{segment === "MF" ? "Fund name" : "Symbol / Ticker"}</Label>
            <Input value={sym} onChange={setSym} placeholder={segment === "MF" ? "HDFC Flexi Cap Fund" : "e.g. RELIANCE"} upper={segment !== "MF"} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quantity</Label>
              <Input value={qty} onChange={setQty} placeholder="0" numeric />
            </div>
            {mode === "holding" ? (
              <div><Label>Avg cost {cur}</Label><Input value={avg} onChange={setAvg} placeholder="0.00" numeric /></div>
            ) : (
              <div><Label>Target rate {cur}</Label><Input value={target} onChange={setTarget} placeholder="0.00" numeric /></div>
            )}
          </div>

          <div>
            <Label>Current market price {cur} · optional</Label>
            <Input value={ltp} onChange={setLtp} placeholder="0.00" numeric />
          </div>

          <div>
            <Label>Note · optional</Label>
            <Input value={note} onChange={setNote} placeholder="e.g. Breakout above 200-DMA" />
          </div>

          <Btn onClick={submit} disabled={!canSave} className="w-full" size="lg">
            <Check size={14} /> Save {mode === "holding" ? "holding" : "to watchlist"}
          </Btn>
        </div>
      </div>
    </div>
  );
};
