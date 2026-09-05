import { LoginScreen } from "@/features/auth/LoginScreen";
import { FONT_MONO, T } from "@/theme/tokens";
import { useAuth } from "@/data/auth";

/** Shows the login until the backend says this browser is in. */
export const Gate = ({ children }: { children: React.ReactNode }) => {
  const { status } = useAuth();
  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg }}>
        <span className="text-[11px]" style={{ color: T.fgDim, ...FONT_MONO }}>checking session…</span>
      </div>
    );
  }
  if (status === "anonymous" || status === "unreachable") return <LoginScreen />;
  return (
    <>
      {children}
      {status === "preview" && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[60] px-3 py-1.5 rounded-full text-[10.5px] font-semibold"
          style={{ background: T.warn, color: "#000", ...FONT_MONO }}>
          Read-only preview · no backend connected
        </div>
      )}
    </>
  );
};
