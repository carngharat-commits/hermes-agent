/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { Sparkles } from "lucide-react";

import { Card, CardHeader } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { T } from "@/theme/tokens";

export const Stub = ({ title, icon: Ic, chunk, features }: any) => (
  <div className="space-y-5">
    <div>
      <h1 className="text-[22px] font-bold tracking-tight flex items-center gap-2">
        <Ic size={20} color={T.primary} /> {title}
      </h1>
      <div className="text-[12px] mt-1" style={{ color: T.fgMute }}>Rolling out in Chunk {chunk} — real content, not filler.</div>
    </div>
    <Card>
      <CardHeader title="Coming in Chunk " subtitle={`This module will include:`} icon={Sparkles} right={<Pill tone="info">Chunk {chunk}</Pill>} />
      <ul className="space-y-2.5 mt-2">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-[12.5px] leading-relaxed">
            <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: T.primary }} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </Card>
  </div>
);
