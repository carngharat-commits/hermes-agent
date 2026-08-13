import { X } from "lucide-react";

import { FONT_MONO, T } from "@/theme/tokens";
import { Pill } from "@/components/ui/Pill";
import type { Recommendation } from "@/api/intel";

/**
 * Why the AI said what it said.
 *
 * The spec's rule is the whole reason this exists: *users should never see an
 * unexplained AI decision*. Before this, a row showed `AI HOLD 32%` and there
 * was nowhere to find out why — which is worst for exactly the calls that most
 * need explaining, the ones a portfolio brake pulled back from a BUY.
 *
 * Everything here is read from the recommendation's stored `evidence`, not
 * regenerated. The explanation is assembled from the same agent views that
 * produced the score, so it cannot drift from the arithmetic, and an old call
 * opened months later still reads in the terms it was actually made.
 */

const TONE: Record<string, string> = {
  BUY: "up", HOLD: "info", REDUCE: "warn", SELL: "down", AVOID: "neutral",
};

const STANCE_COLOR = (score: number | null) =>
  score == null ? T.fgDim : score > 5 ? T.up : score < -5 ? T.down : T.fgMute;

type AgentRow = {
  agent: string;
  stance: string;
  score: number | null;
  confidence: number;
  summary: string;
  detail?: { reasons?: string[] } & Record<string, any>;
};

const label = (agent: string) => agent.replace(/_/g, " ");

export const AIExplainDrawer = ({
  rec, onClose,
}: { rec: Recommendation; onClose: () => void }) => {
  const evidence = (rec.evidence ?? {}) as Record<string, any>;
  const contributing: AgentRow[] = evidence.contributing ?? [];
  const abstained: { agent: string; why: string }[] = evidence.abstained ?? [];
  const weights: Record<string, number> = evidence.weights_used ?? {};

  // Calls recorded before the forecast/brake split have no restraint figures.
  // Show the blend alone rather than inventing the breakdown.
  const forecast: number | null = evidence.forecast_score ?? null;
  const blended: number | null = evidence.blended_score ?? null;
  const factor: number | null = evidence.restraint_factor ?? null;
  const braked = forecast != null && blended != null && factor != null
    && factor < 0.999 && forecast > 0;

  const brakes = contributing.filter((a) => (a.score ?? 0) <= 0 && isBrake(a.agent));
  const forecasts = contributing.filter((a) => !isBrake(a.agent));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[640px] mx-auto rounded-t-2xl lg:rounded-2xl lg:mb-8 overflow-hidden flex flex-col"
        style={{ background: T.card, border: `1px solid ${T.border}`,
                 height: "92vh", maxHeight: "820px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 py-3.5 shrink-0"
          style={{ background: T.card, borderBottom: `1px solid ${T.border}` }}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[15px] font-bold" style={FONT_MONO}>{rec.symbol}</span>
              <Pill tone={TONE[rec.action] ?? "neutral"}>
                {rec.action} {rec.confidence?.toFixed(0)}%
              </Pill>
            </div>
            <div className="text-[10.5px] mt-1" style={{ color: T.fgMute, ...FONT_MONO }}>
              why the AI said this
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: T.card2 }}
            aria-label="Close"
          >
            <X size={15} color={T.fgMute} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">

          {/* How the number was reached. */}
          {blended != null && (
            <Section title="How the score was reached">
              <div className="space-y-1.5">
                {forecast != null && (
                  <Line
                    left="what the forecasters said"
                    right={forecast.toFixed(0)}
                    color={STANCE_COLOR(forecast)}
                  />
                )}
                {braked && (
                  <Line
                    left={`held back by portfolio exposure (×${factor!.toFixed(2)})`}
                    right={`−${(forecast! - blended).toFixed(0)}`}
                    color={T.warn}
                  />
                )}
                <div style={{ borderTop: `1px dashed ${T.border}` }} />
                <Line
                  left="final score"
                  right={blended.toFixed(0)}
                  color={STANCE_COLOR(blended)}
                  bold
                />
              </div>
              {braked && (
                <p className="text-[10.5px] mt-2.5 leading-relaxed" style={{ color: T.fgMute }}>
                  Portfolio exposure limits <em>adding</em> to this position — it is
                  not a reason to sell.
                  {/* Only a counterfactual when the brake actually changed the
                      call. Stating "would have been a BUY" on a call that is a
                      BUY reads as a downgrade that never happened. */}
                  {bandOf(forecast!) !== rec.action ? (
                    <>
                      {" "}Without it this would have been a{" "}
                      <strong style={{ color: T.fg }}>{bandOf(forecast!)}</strong>.
                    </>
                  ) : (
                    <> It lowered the score but not the call.</>
                  )}
                </p>
              )}
            </Section>
          )}

          {/* Who forecast a direction. */}
          {forecasts.length > 0 && (
            <Section title="What the forecasters found">
              {forecasts.map((a) => (
                <AgentCard key={a.agent} row={a} weight={weights[a.agent]} />
              ))}
            </Section>
          )}

          {/* Who applied a brake. */}
          {brakes.length > 0 && (
            <Section
              title="What your portfolio says"
              note="These read the book you already hold. They can cap a BUY at a HOLD; they never produce a SELL."
            >
              {brakes.map((a) => (
                <AgentCard key={a.agent} row={a} weight={weights[a.agent]} />
              ))}
            </Section>
          )}

          {/* What the AI was not looking at. Named, not hidden. */}
          {abstained.length > 0 && (
            <Section
              title="Not considered"
              note="These agents had no data to work from. Their absence is stated rather than quietly ignored."
            >
              {abstained.map((a) => (
                <div
                  key={a.agent}
                  className="rounded-lg px-3 py-2"
                  style={{ background: T.subtle2, border: `1px solid ${T.border}` }}
                >
                  <div
                    className="text-[10px] uppercase tracking-wider font-semibold"
                    style={{ color: T.fgDim, ...FONT_MONO }}
                  >
                    {label(a.agent)}
                  </div>
                  <div className="text-[11px] mt-0.5 leading-relaxed" style={{ color: T.fgMute }}>
                    {a.why}
                  </div>
                </div>
              ))}
            </Section>
          )}

          {/* Provenance. An old call must be re-readable as it was made. */}
          <Section title="Provenance">
            <div className="grid grid-cols-2 gap-y-1.5 text-[10.5px]" style={FONT_MONO}>
              <span style={{ color: T.fgDim }}>recorded</span>
              <span style={{ color: T.fgMute }}>
                {rec.created_at ? new Date(rec.created_at).toLocaleString() : "—"}
              </span>
              <span style={{ color: T.fgDim }}>version</span>
              <span style={{ color: T.fgMute }}>v{rec.version ?? 1}</span>
              <span style={{ color: T.fgDim }}>engine</span>
              <span style={{ color: T.fgMute }}>{evidence.engine ?? "—"}</span>
              <span style={{ color: T.fgDim }}>price at the time</span>
              <span style={{ color: T.fgMute }}>₹{rec.market_price?.toFixed(2)}</span>
            </div>
            <p className="text-[10px] mt-2.5 leading-relaxed" style={{ color: T.fgDim }}>
              Recommendations are never overwritten. A newer call supersedes this
              one; this row stays exactly as it was recorded.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
};

/** Brakes are named on the server; this list mirrors `agents.NON_DIRECTIONAL`. */
const BRAKES = new Set(["portfolio_risk", "cross_market", "diversification"]);
const isBrake = (agent: string) => BRAKES.has(agent);

/** Which action a raw score would map to — mirrors the consolidator's bands. */
const bandOf = (score: number) =>
  score >= 45 ? "BUY" : score >= -15 ? "HOLD" : score >= -45 ? "REDUCE" : "SELL";

const Section = ({ title, note, children }: any) => (
  <div>
    <div
      className="text-[9.5px] uppercase tracking-[0.15em] mb-2"
      style={{ color: T.fgDim, ...FONT_MONO }}
    >
      {title}
    </div>
    {note && (
      <p className="text-[10.5px] mb-2 leading-relaxed" style={{ color: T.fgDim }}>
        {note}
      </p>
    )}
    <div className="space-y-2">{children}</div>
  </div>
);

const Line = ({ left, right, color, bold }: any) => (
  <div className="flex items-baseline justify-between gap-3">
    <span className="text-[11px]" style={{ color: T.fgMute }}>{left}</span>
    <span
      className={`text-[12px] ${bold ? "font-bold" : "font-semibold"}`}
      style={{ color, ...FONT_MONO }}
    >
      {right}
    </span>
  </div>
);

const AgentCard = ({ row, weight }: { row: AgentRow; weight?: number }) => {
  const reasons = row.detail?.reasons ?? [];
  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{ background: T.subtle2, border: `1px solid ${T.border}` }}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span
          className="text-[10px] uppercase tracking-wider font-semibold"
          style={{ color: T.fgMute, ...FONT_MONO }}
        >
          {label(row.agent)}
        </span>
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-bold"
            style={{ color: STANCE_COLOR(row.score), ...FONT_MONO }}
          >
            {row.score == null ? "—" : `${row.score > 0 ? "+" : ""}${row.score.toFixed(0)}`}
          </span>
          <span className="text-[9.5px]" style={{ color: T.fgDim, ...FONT_MONO }}>
            {row.confidence?.toFixed(0)}% sure
            {weight != null && ` · weight ${weight.toFixed(2)}`}
          </span>
        </div>
      </div>
      {reasons.length > 0 && (
        <ul className="mt-1.5 space-y-1">
          {reasons.map((reason, i) => (
            <li key={i} className="text-[11px] leading-relaxed" style={{ color: T.fg }}>
              • {reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
