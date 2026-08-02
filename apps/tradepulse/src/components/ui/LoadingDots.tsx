/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { T } from "@/theme/tokens";

export const LoadingDots = () => (
  <span className="inline-flex gap-1 items-center py-1">
    <span className="w-1.5 h-1.5 rounded-full" style={{ background: T.fgMute, animation: "aiPulse 1.4s ease-in-out infinite" }} />
    <span className="w-1.5 h-1.5 rounded-full" style={{ background: T.fgMute, animation: "aiPulse 1.4s ease-in-out 0.2s infinite" }} />
    <span className="w-1.5 h-1.5 rounded-full" style={{ background: T.fgMute, animation: "aiPulse 1.4s ease-in-out 0.4s infinite" }} />
    <style>{`@keyframes aiPulse { 0%,80%,100% { opacity: 0.3; } 40% { opacity: 1; } }`}</style>
  </span>
);
