/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { useState, useRef, useEffect } from "react";
import { ChevronRight, Info, Sparkles, X } from "lucide-react";

import { Btn } from "@/components/ui/Btn";
import { ChatBubble } from "@/features/ai/ChatBubble";
import { FONT_BODY, FONT_MONO, T } from "@/theme/tokens";

export const AIChatDrawer = ({ context, onClose }: any) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  const d = context.data;
  const isSignal = context.type === "signal";

  const contextSummary = isSignal
    ? `${d.sym} · ${d.action} · ${d.timeframe}`
    : `${d.sym} · ${d.category} · Confidence ${d.confidence}`;

  const SYSTEM_PROMPT = `You are an embedded market analyst inside TradePulse, a portfolio decision-support app for Rahul Gharat, an HUF investor in Thane, Mumbai. Rahul holds a real, diversified book across Zerodha, ABML, INDmoney, Groww, CoinDCX, WazirX, and PhonePe.

Your job on this screen:
- Explain the reasoning behind a specific trading signal or opportunity in plain terms
- Discuss what current market/macro conditions are influencing it (Fed path, crude, RBI, USD/INR, sector rotation, geopolitics)
- Think through future scenarios: "if X prevails, then Y is likely; here's what to watch and what precautions to take"
- Always frame invalidation triggers — "this thesis breaks if..."
- Reference the three axes explicitly: Technical (chart), Fundamental (business), Macro (news/policy/rates)
- Stay SEBI-compliant: decision-support, never direct investment advice

Response style:
- Concise, structured, real numbers where relevant
- 2-4 short paragraphs typically, use lists only if necessary
- Speak with warmth but professional
- Acknowledge uncertainty honestly; don't overclaim
- If the question is unclear, ask one clarifying question

Never say "as an AI I can't advise" — instead give framing and discussion.`;

  const contextMessage = isSignal
    ? `Here is the current signal I'm looking at:

SYMBOL: ${d.sym}
ACTION: ${d.action}   TIMEFRAME: ${d.timeframe}
CONFIDENCE: ${d.confidence}/100   RISK SCORE: ${d.riskScore}/100
LTP: ${d.userPos?.currency === "USD" ? "$" : "₹"}${d.ltp}
ENTRY: ${d.entry ?? "—"}   TARGET: ${d.target ?? "—"}   STOP: ${d.sl ?? "—"}

REASONING
- Technical: ${d.reasoning.technical}
- Fundamental: ${d.reasoning.fundamental}
- Macro: ${d.reasoning.macro}

FAILURE SCENARIO (already noted): ${d.failureScenario}

MY POSITION: ${d.userPos ? `Qty ${d.userPos.qty} @ avg ${d.userPos.currency==="USD"?"$":"₹"}${d.userPos.avg}, current P&L ${d.userPos.currency==="USD"?"$":"₹"}${d.userPos.pl} (${d.userPos.plPct}%)` : "None"}
BROKERS: ${d.accounts.join(", ")}

Current market context (30 July 2026): Nifty 24,812 (+0.73%), IndiaVIX 13.4, USD-INR ~85, WTI ~$71, Fed dovish tilt with 82% odds of 25bp Sep cut, RBI expected to hold at 6.25% on Aug 6, monsoon 4% above LPA, China deflation drag persists, Trump tariff talk resurging.`
    : `Here is the current opportunity I'm looking at:

SYMBOL: ${d.sym}
CATEGORY: ${d.category}   TIMEFRAME: ${d.timeframe}
CONFIDENCE: ${d.confidence}/100
MARKET CAP: ${d.mcap}   SECTOR: ${d.sector}
LTP: ₹${d.ltp}   ENTRY: ${d.entryLo ? `₹${d.entryLo}-${d.entryHi}` : "—"}   TARGET: ${d.target ? `₹${d.target}` : "—"}   STOP: ${d.sl ? `₹${d.sl}` : "—"}
RISK-REWARD: ${d.rr ? `1:${d.rr.toFixed(1)}` : "—"}

WHY THIS CAME UP: ${d.why}
IN MY BOOK ALREADY: ${d.inYourBook ? "YES — already owned" : "No — potential new position"}

Current market context (30 July 2026): Nifty 24,812 (+0.73%), IndiaVIX 13.4, USD-INR ~85, WTI ~$71, Fed dovish tilt with 82% odds of 25bp Sep cut, RBI expected to hold at 6.25% on Aug 6, monsoon 4% above LPA, sector rotation phase = Late Cycle (favor Consumer/Utilities/Pharma).`;

  const suggested = isSignal ? [
    "Why this call now, in one paragraph?",
    "What conditions would flip this to the opposite call?",
    "If Fed doesn't cut in Sep, what happens to this?",
    "Walk me through the bear scenario in detail",
    "How does this fit with the rest of my book?",
  ] : [
    "Why is confidence set at this level?",
    "What macro conditions must hold for this to work?",
    "If crude spikes above $85, does this still work?",
    "What's the base vs bull vs bear case here?",
    "Compare this to my existing holdings — overlap risk?",
  ];

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const send = async (text) => {
    if (!text.trim() || loading) return;
    const newMsgs = [...messages, { role: "user", content: text }];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: [
            { role: "user", content: contextMessage },
            { role: "assistant", content: "Got the context. Ask me anything about this call — the reasoning, current conditions affecting it, or future scenarios to watch." },
            ...newMsgs,
          ],
        }),
      });
      const data = await response.json();
      let reply = "";
      if (data.content && Array.isArray(data.content)) {
        reply = data.content.filter(c => c.type === "text").map(c => c.text).join("\n").trim();
      }
      if (!reply) reply = "I couldn't generate a response — try rephrasing?";
      setMessages([...newMsgs, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages([...newMsgs, { role: "assistant", content: `Couldn't reach the model. ${err.message || "Try again in a moment."}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-[560px] mx-auto rounded-t-2xl lg:rounded-2xl lg:mb-8 overflow-hidden flex flex-col"
        style={{ background: T.card, border: `1px solid ${T.border}`, height: "88vh", maxHeight: "700px" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 shrink-0"
          style={{ background: T.card, borderBottom: `1px solid ${T.border}` }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${T.primary}18`, border: `1px solid ${T.primary}30` }}>
              <Sparkles size={15} color={T.primary} />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-bold">Ask AI</div>
              <div className="text-[10.5px] truncate" style={{ color: T.fgMute, ...FONT_MONO }}>{contextSummary}</div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: T.card2 }}>
            <X size={15} color={T.fgMute} />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <>
              <div className="p-3 rounded-lg" style={{ background: `${T.primary}10`, border: `1px solid ${T.primary}30` }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <Info size={11} color={T.primary} />
                  <div className="text-[10.5px] uppercase tracking-widest font-semibold" style={{ color: T.primary, ...FONT_MONO }}>Decision-support only</div>
                </div>
                <div className="text-[11.5px] leading-relaxed" style={{ color: T.fg }}>
                  I can explain the reasoning, discuss current conditions, and think through future scenarios. Not investment advice — framing to help you decide.
                </div>
              </div>

              <div className="text-[10.5px] uppercase tracking-widest font-semibold mt-4 mb-1.5" style={{ color: T.fgMute, ...FONT_MONO }}>
                Try asking
              </div>
              <div className="space-y-1.5">
                {suggested.map((s, i) => (
                  <button key={i} onClick={() => send(s)}
                    className="w-full text-left p-2.5 rounded-lg text-[12px] flex items-center gap-2 transition-colors"
                    style={{ background: T.card2, border: `1px solid ${T.border}`, color: T.fg }}>
                    <ChevronRight size={12} color={T.primary} className="shrink-0" />
                    <span>{s}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              {messages.map((m, i) => <ChatBubble key={i} role={m.role} content={m.content} />)}
              {loading && <ChatBubble role="assistant" content="" loading />}
            </>
          )}
        </div>

        {/* Input */}
        <div className="p-3 shrink-0" style={{ background: T.card, borderTop: `1px solid ${T.border}` }}>
          <div className="flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder={`Ask about ${d.sym}...`}
              disabled={loading}
              className="flex-1 px-3 py-2.5 rounded-lg text-[12.5px] outline-none"
              style={{ background: T.card2, border: `1px solid ${T.border}`, color: T.fg, ...FONT_BODY }} />
            <Btn onClick={() => send(input)} disabled={!input.trim() || loading}>
              Send
            </Btn>
          </div>
          <div className="text-[9.5px] mt-2" style={{ color: T.fgDim, ...FONT_MONO }}>
            Powered by Claude · Chat resets when you close this window
          </div>
        </div>
      </div>
    </div>
  );
};
