"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { loadBoard, type Board } from "@/lib/queries";
import { apiPost } from "@/lib/api";
import { can } from "@/lib/permissions";
import type { Profile, Role } from "@/lib/types";
import EmployeeDashboard from "./employee/EmployeeDashboard";

// A team member's detail with the management actions available to the caller. The actual
// authorization + separation of duties are enforced server-side (RLS + the validate route);
// these buttons just surface what the caller may do.
export default function MemberDetail({
  member,
  role,
  selfId,
  onBack,
}: {
  member: Profile;
  role: Role | null;
  selfId: string;
  onBack: () => void;
}) {
  const [board, setBoard] = useState<Board | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => setBoard(await loadBoard(member.id)), [member.id]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; setState runs after the awaited load, not a synchronous cascade
  useEffect(() => { load(); }, [load]);

  async function run(fn: () => Promise<void>, okMsg: string) {
    setBusy(true); setError(null); setMsg(null);
    try {
      await fn();
      setMsg(okMsg);
      await load();
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
    setBusy(false);
  }

  const latestTna = board?.tnas.find((t) => board.cycle && t.cycle_year === board.cycle.current_year) ?? board?.tnas[0] ?? null;
  const ildp = board?.ildp ?? null;
  const notSelf = member.id !== selfId;

  async function validateTna() {
    if (!latestTna) return;
    await apiPost(`/api/tna/${latestTna.id}/validate`);
  }
  async function endorse() {
    if (!ildp) return;
    const { error } = await getSupabase().from("ildp").update({ status: "pending_approval", endorsed_by: selfId, endorsed_at: new Date().toISOString() }).eq("id", ildp.id);
    if (error) throw new Error(error.message);
  }
  async function approve() {
    if (!ildp) return;
    const { error } = await getSupabase().from("ildp").update({ status: "active", approved_by: selfId, approved_at: new Date().toISOString() }).eq("id", ildp.id);
    if (error) throw new Error(error.message);
  }
  async function advanceYear() {
    if (!board?.cycle) return;
    await apiPost(`/api/cycle/${board.cycle.id}/advance-year`);
  }

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-sm text-sky-600 hover:underline">← Back to team</button>
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{member.full_name ?? member.email}</h2>
          <p className="text-sm text-slate-500">{member.email} · {member.department}</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {notSelf && latestTna?.status === "submitted" && can(role, "validate_tna") && (
            <button onClick={() => run(validateTna, "TNA validated — plan generated.")} disabled={busy} className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60">Validate TNA</button>
          )}
          {notSelf && ildp?.status === "pending_endorsement" && can(role, "endorse_ildp") && (
            <button onClick={() => run(endorse, "ILDP endorsed.")} disabled={busy} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">Endorse ILDP</button>
          )}
          {notSelf && ildp?.status === "pending_approval" && can(role, "approve_ildp") && (
            <button onClick={() => run(approve, "ILDP approved — active.")} disabled={busy} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">Approve ILDP</button>
          )}
          {board?.cycle && can(role, "advance_year") && (
            <button onClick={() => run(advanceYear, "Advanced to next year — new TNA opened.")} disabled={busy} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">Advance year</button>
          )}
        </div>
      </div>
      {msg && <p className="text-sm text-emerald-600">{msg}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
        Cycle: {board?.cycle ? `Year ${board.cycle.current_year}, ${board.cycle.status}` : "none"} · TNA: {latestTna?.status ?? "none"} · ILDP: {ildp?.status ?? "none"}
      </div>
      <EmployeeDashboard key={refreshKey} userId={member.id} />
    </div>
  );
}
