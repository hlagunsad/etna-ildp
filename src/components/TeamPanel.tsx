"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { Profile, Role } from "@/lib/types";
import MemberDetail from "./MemberDetail";

type Summary = { cycleYear: number | null; cycleStatus: string | null; tnaStatus: string | null; ildpStatus: string | null };

export default function TeamPanel({ selfId, role }: { selfId: string; role: Role | null }) {
  const [members, setMembers] = useState<Profile[]>([]);
  const [statusById, setStatusById] = useState<Record<string, Summary>>({});
  const [selected, setSelected] = useState<Profile | null>(null);

  const load = useCallback(async () => {
    const sb = getSupabase();
    const { data: reports } = await sb
      .from("profiles")
      .select("id, full_name, email, role, manager_id, job_role_id, department, status")
      .eq("manager_id", selfId);
    const list = (reports ?? []) as Profile[];
    setMembers(list);

    const summary: Record<string, Summary> = {};
    for (const m of list) {
      const { data: cycle } = await sb.from("dev_cycle").select("id, current_year, status").eq("user_id", m.id).maybeSingle();
      let s: Summary = { cycleYear: null, cycleStatus: null, tnaStatus: null, ildpStatus: null };
      if (cycle) {
        const { data: tnas } = await sb.from("tna_assessment").select("status").eq("dev_cycle_id", cycle.id).order("cycle_year", { ascending: false }).limit(1);
        const { data: ildp } = await sb.from("ildp").select("status").eq("dev_cycle_id", cycle.id).maybeSingle();
        s = { cycleYear: cycle.current_year, cycleStatus: cycle.status, tnaStatus: tnas?.[0]?.status ?? null, ildpStatus: ildp?.status ?? null };
      }
      summary[m.id] = s;
    }
    setStatusById(summary);
  }, [selfId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; setState runs after the awaited load, not a synchronous cascade
  useEffect(() => { load(); }, [load]);

  if (selected) {
    return <MemberDetail member={selected} role={role} selfId={selfId} onBack={() => { setSelected(null); load(); }} />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900">My Team</h2>
        <p className="text-sm text-slate-500">Your direct reports. Open a member to validate their TNA or endorse their plan.</p>
      </div>
      {members.length === 0 && <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">No direct reports.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {members.map((m) => {
          const s = statusById[m.id];
          const needsAction = s?.tnaStatus === "submitted" || s?.ildpStatus === "pending_endorsement";
          return (
            <button key={m.id} onClick={() => setSelected(m)} className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-sky-300 hover:shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">{m.full_name ?? m.email}</span>
                {needsAction && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Action needed</span>}
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{m.department}</p>
              <p className="mt-2 text-xs text-slate-500">
                Cycle: {s?.cycleYear ? `Y${s.cycleYear} ${s.cycleStatus}` : "—"} · TNA: {s?.tnaStatus ?? "—"} · ILDP: {s?.ildpStatus ?? "—"}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
