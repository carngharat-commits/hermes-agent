/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { Lock } from "lucide-react";

import { BROKERS_CONNECTED } from "@/data/brokers";
import { Card } from "@/components/ui/Card";
import { FONT_MONO, T } from "@/theme/tokens";
import { Row } from "@/components/ui/Row";

export const APIKeysView = () => (
  <div className="space-y-4">
    <Card>
      <div className="flex items-start gap-2 p-3 rounded-lg" style={{ background: `${T.warn}10`, border: `1px solid ${T.warn}30` }}>
        <Lock size={13} color={T.warn} className="mt-0.5 shrink-0" />
        <div className="text-[11px] leading-relaxed" style={{ color: T.fg }}>
          <span className="font-semibold">API keys are encrypted at rest.</span> Never share your secret key. Revoke immediately if compromised. Read-only scope is enforced for all brokers.
        </div>
      </div>
    </Card>

    <Card padded={false}>
      {BROKERS_CONNECTED.map(b => (
        <Row key={b.k}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0"
              style={{ background: T.card2, border: `1px solid ${T.border}`, color: T.fg, ...FONT_MONO }}>
              {b.name.split(" ").map(x => x[0]).join("").slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-semibold">{b.name}</div>
              <div className="text-[10.5px]" style={{ color: T.fgMute, ...FONT_MONO }}>
                {b.auth} · ••••{1000 + (b.k.split("").reduce((s, c) => s + c.charCodeAt(0), 0) % 9000)}
              </div>
            </div>
            <button
              onClick={() => alert(`Rotate API key for ${b.name}?\n\nOld key will be revoked immediately. You'll need to re-authorize.`)}
              className="px-2.5 py-1.5 rounded-lg text-[10.5px] font-semibold shrink-0"
              style={{ background: T.card2, color: T.fg, border: `1px solid ${T.border}` }}>
              Rotate key
            </button>
          </div>
        </Row>
      ))}
    </Card>
  </div>
);
