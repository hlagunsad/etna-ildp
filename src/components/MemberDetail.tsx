"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { loadBoard, type Board } from "@/lib/queries";
import { apiPost } from "@/lib/api";
import { useCan } from "./PermissionsProvider";
import { Button, Card } from "./ui";
import type { Profile, Role } from "@/lib/types";
import EmployeeDashboard from "./employee/EmployeeDashboard";
import TnaReview from "./TnaReview";

// A team member's detail with the management actions available to the caller. Authorization +
// separation of duties are enforced server-side (RLS + the validate route); these buttons just
// surface what the caller may do.
export default function MemberDetail({
  member,
  role,
  selfId,
  orgUnitName,
  onBack,
}: {
  member: Profile;
  role: Role | null;
  selfId: string;
  orgUnitName?: string | null;
  onBack: () => void;
}) {
  const can = useCan();
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

  async function onTnaValidated() {
    setMsg("TNA validated — plan generated.");
    setError(null);
    await load();
    setRefreshKey((k) => k + 1);
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
      <button onClick={onBack} className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-brand hover:underline">
        <span aria-hidden>←</span> Back to team
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold text-ink">{member.full_name ?? member.email}</h1>
          <p className="text-sm text-muted">{member.email}{orgUnitName ? ` · ${orgUnitName}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {notSelf && ildp?.status === "pending_endorsement" && can(role, "endorse_ildp") && (
            <Button onClick={() => run(endorse, "ILDP endorsed.")} disabled={busy}>Endorse ILDP</Button>
          )}
          {notSelf && ildp?.status === "pending_approval" && can(role, "approve_ildp") && (
            <Button onClick={() => run(approve, "ILDP approved — active.")} disabled={busy}>Approve ILDP</Button>
          )}
          {board?.cycle && can(role, "advance_year") && (
            <Button variant="secondary" onClick={() => run(advanceYear, "Advanced to next year — new TNA opened.")} disabled={busy}>Advance year</Button>
          )}
        </div>
      </div>

      {msg && <p role="status" className="text-sm font-medium text-success">{msg}</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      <Card className="px-4 py-2.5 text-xs text-muted">
        Cycle: {board?.cycle ? `Year ${board.cycle.current_year}, ${board.cycle.status}` : "none"} · TNA: {latestTna?.status ?? "none"} · ILDP: {ildp?.status ?? "none"}
      </Card>

      {notSelf && latestTna?.status === "submitted" && can(role, "validate_tna") && (
        <TnaReview tnaId={latestTna.id} onValidated={onTnaValidated} />
      )}

      <EmployeeDashboard key={refreshKey} userId={member.id} embedded />
    </div>
  );
}
