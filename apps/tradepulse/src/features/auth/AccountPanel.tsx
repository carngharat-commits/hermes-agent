import { useEffect, useState } from "react";
import { KeyRound, UserPlus, Users } from "lucide-react";

import { addUser, changePassword, listUsers, type AuthUser } from "@/api/auth";
import { Card, CardHeader } from "@/components/ui/Card";
import { FONT_MONO, T } from "@/theme/tokens";
import { Pill } from "@/components/ui/Pill";
import { useAuth } from "@/data/useAuth";

const input = (props: any) => (
  <input {...props} className="w-full rounded-lg px-3 py-2 text-[12.5px]"
    style={{ background: T.card2, color: T.fg, border: `1px solid ${T.border}` }} />
);

/** Change your password; the owner also sees and adds accounts. */
export const AccountPanel = () => {
  const auth = useAuth();
  const isOwner = auth.user?.role === "owner";

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pwNote, setPwNote] = useState<{ ok: boolean; text: string } | null>(null);

  const [users, setUsers] = useState<(AuthUser & { id: number })[]>([]);
  const [nu, setNu] = useState({ name: "", username: "", password: "" });
  const [addNote, setAddNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!isOwner || auth.status !== "authenticated") return;
    listUsers().then((r) => setUsers(r.users)).catch(() => setUsers([]));
  }, [isOwner, auth.status]);

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await changePassword(current, next);
      setPwNote({ ok: true, text: "Password changed." });
      setCurrent(""); setNext("");
    } catch (err) {
      setPwNote({ ok: false, text: (err as Error).message });
    }
  };

  const submitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await addUser(nu);
      setUsers((u) => [...u, r.user]);
      setAddNote({ ok: true, text: `Added ${r.user.username}.` });
      setNu({ name: "", username: "", password: "" });
    } catch (err) {
      setAddNote({ ok: false, text: (err as Error).message });
    }
  };

  if (auth.status !== "authenticated") return null;

  const note = (n: { ok: boolean; text: string } | null) => n && (
    <div role="status" className="mt-2 text-[11px]" style={{ color: n.ok ? T.up : T.down }}>{n.text}</div>
  );

  return (
    <>
      <Card>
        <CardHeader title="Password" icon={KeyRound} />
        <form onSubmit={submitPassword} className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {input({ type: "password", placeholder: "Current password", autoComplete: "current-password",
                   value: current, onChange: (e: any) => setCurrent(e.target.value), "aria-label": "Current password" })}
          {input({ type: "password", placeholder: "New password (10+ characters)", autoComplete: "new-password",
                   value: next, onChange: (e: any) => setNext(e.target.value), "aria-label": "New password" })}
          <button type="submit" disabled={!current || next.length < 10}
            className="md:col-span-2 py-2 rounded-lg text-[12px] font-semibold"
            style={{ background: T.primary, color: "#000", opacity: !current || next.length < 10 ? 0.5 : 1 }}>
            Change password
          </button>
        </form>
        {note(pwNote)}
      </Card>

      {isOwner && (
        <Card>
          <CardHeader title="Accounts" subtitle="Only the owner sees this" icon={Users} />
          <div className="space-y-1.5 mb-4">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: T.card2 }}>
                <div>
                  <span className="text-[12.5px] font-semibold">{u.name}</span>
                  <span className="text-[11px] ml-2" style={{ color: T.fgMute, ...FONT_MONO }}>@{u.username}</span>
                </div>
                <Pill tone={u.role === "owner" ? "up" : "neutral"} size="xs">{u.role}</Pill>
              </div>
            ))}
          </div>
          <form onSubmit={submitUser} className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {input({ placeholder: "Name", value: nu.name, "aria-label": "New account name",
                     onChange: (e: any) => setNu({ ...nu, name: e.target.value }) })}
            {input({ placeholder: "username", autoCapitalize: "none", value: nu.username, "aria-label": "New account username",
                     onChange: (e: any) => setNu({ ...nu, username: e.target.value }) })}
            {input({ type: "password", placeholder: "Password (10+)", autoComplete: "new-password", value: nu.password,
                     "aria-label": "New account password", onChange: (e: any) => setNu({ ...nu, password: e.target.value }) })}
            <button type="submit" disabled={!nu.username || nu.password.length < 10}
              className="md:col-span-3 py-2 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-2"
              style={{ background: T.card2, color: T.fg, border: `1px solid ${T.border}`,
                       opacity: !nu.username || nu.password.length < 10 ? 0.5 : 1 }}>
              <UserPlus size={13} /> Add account
            </button>
          </form>
          {note(addNote)}
        </Card>
      )}
    </>
  );
};
