/* Lifted verbatim from the original single-file TradePulse artifact.
   Only the module header and the `export` keyword are new. */

import { LoadingDots } from "@/components/ui/LoadingDots";
import { T } from "@/theme/tokens";

export const ChatBubble = ({ role, content, loading }: any) => {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[85%] px-3 py-2 rounded-lg text-[12.5px] leading-relaxed"
        style={{
          background: isUser ? T.primary : T.card2,
          color: isUser ? "#000" : T.fg,
          border: isUser ? "none" : `1px solid ${T.border}`,
          whiteSpace: "pre-wrap",
          fontWeight: isUser ? 500 : 400,
        }}>
        {loading ? <LoadingDots /> : content}
      </div>
    </div>
  );
};
