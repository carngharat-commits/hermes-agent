import { Pill } from "@/components/ui/Pill";
import { FONT_MONO, T } from "@/theme/tokens";
import { inr } from "@/lib/format";
import type { EnrichedRow } from "@/api/intel";

/**
 * Intrinsic value line for a holding or watchlist row.
 *
 * Additive by design: renders nothing when the symbol has no fundamentals, so
 * an uncovered row looks exactly as it did before the intelligence layer
 * existed. The provider is named on screen — a stub valuation must never read
 * as a real one.
 */
export const ValuationStrip = ({ row }: { row?: EnrichedRow }) => {
  if (!row?.covered || !row.valuation?.intrinsic_value) return null;

  const v = row.valuation;
  const margin = v.margin_of_safety ?? 0;
  const cheap = margin > 0;
  const action = row.recommendation?.action;

  return (
    <div
      className="mt-2 pt-2 flex flex-wrap items-center gap-x-3 gap-y-1"
      style={{ borderTop: `1px dashed ${T.border}` }}
    >
      <span className="text-[9.5px] uppercase tracking-[0.15em]" style={{ color: T.fgDim, ...FONT_MONO }}>
        Intrinsic
      </span>
      <span className="text-[11px] font-semibold" style={{ color: T.fg, ...FONT_MONO }}>
        {inr(v.intrinsic_value, 0)}
      </span>

      <Pill tone={cheap ? "up" : "down"} size="xs">
        {cheap ? `${(margin * 100).toFixed(0)}% MOS` : `${Math.abs(margin * 100).toFixed(0)}% over`}
      </Pill>

      {v.fair_value != null && (
        <span className="text-[10px]" style={{ color: T.fgMute, ...FONT_MONO }}>
          fair {inr(v.fair_value, 0)}
        </span>
      )}
      {v.dcf_value != null && v.epv_value != null && (
        <span className="text-[10px]" style={{ color: T.fgDim, ...FONT_MONO }}>
          DCF {inr(v.dcf_value, 0)} · EPV {inr(v.epv_value, 0)}
        </span>
      )}

      <span className="text-[10px]" style={{ color: T.fgDim, ...FONT_MONO }}>
        health {v.financial_health?.toFixed(0)} · quality {v.business_quality?.toFixed(0)}
      </span>

      {action && (
        <Pill tone={action === "BUY" ? "up" : action === "HOLD" ? "info" : "warn"} size="xs">
          AI {action} {row.recommendation?.confidence?.toFixed(0)}%
        </Pill>
      )}

      {v.provider === "stub" && (
        <button
          onClick={() =>
            alert(
              "Valuation source: stub\n\n" +
                "No fundamentals provider is configured, so these figures are " +
                "computed by the real DCF/EPV engine over hand-built financials. " +
                "The maths is real; the inputs are not this company's filings.\n\n" +
                "Configure a fundamentals feed (EODHD, FMP, Trendlyne) to value " +
                "the actual accounts.",
            )
          }
          title="These figures come from stub financials"
        >
          <Pill tone="warn" size="xs">stub inputs</Pill>
        </button>
      )}
    </div>
  );
};
