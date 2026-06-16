"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { Card, PageHeader, Pill, Spinner } from "./ui";
import type { OrgUnit, Profile, Role } from "@/lib/types";
import MemberDetail from "./MemberDetail";
import { BRAND } from "@/lib/brand";

type Summary = { cycleYear: number | null; cycleStatus: string | null; tnaStatus: string | null; ildpStatus: string | null };

export default function TeamPanel({ selfId, role }: { selfId: string; role: Role | null }) {
  const [members, setMembers] = useState<Profile[] | null>(null);
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [statusById, setStatusById] = useState<Record<string, Summary>>({});
  const [selected, setSelected] = useState<Profile | null>(null);

  const load = useCallback(async () => {
    const sb = getSupabase();
    const [{ data: reports }, { data: units }] = await Promise.all([
      sb.from("profiles").select("id, full_name, email, role, manager_id, job_role_id, org_unit_id, status").eq("manager_id", selfId),
      sb.from("org_unit").select("id, name, description, parent_id").order("name"),
    ]);
    const list = (reports ?? []) as Profile[];
    setMembers(list);
    setOrgUnits((units ?? []) as OrgUnit[]);

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

  const orgUnitName = (id: string | null) => orgUnits.find((u) => u.id === id)?.name ?? null;

  if (selected) {
    return <MemberDetail member={selected} role={role} selfId={selfId} orgUnitName={orgUnitName(selected.org_unit_id)} onBack={() => { setSelected(null); load(); }} />;
  }
  if (!members) return <Spinner />;

  return (
    <>
      <PageHeader title="My Team" subtitle={`Your direct reports. Open a member to validate their ${BRAND.assessment} or endorse their plan.`} />
      {members.length === 0 ? (
        <Card className="p-6 text-sm text-muted">No direct reports.</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {members.map((m) => {
            const s = statusById[m.id];
            const needsAction = s?.tnaStatus === "submitted" || s?.ildpStatus === "pending_endorsement";
            return (
              <button
                key={m.id}
                onClick={() => setSelected(m)}
                className="rounded-2xl border border-line bg-surface p-4 text-left shadow-[0_1px_2px_rgba(28,27,23,0.04)] transition hover:border-brand-100 hover:shadow-[0_10px_30px_-18px_rgba(28,27,23,0.25)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-ink">{m.full_name ?? m.email}</span>
                  {needsAction && <Pill tone="warn">Action needed</Pill>}
                </div>
                <p className="mt-0.5 text-xs text-muted">{orgUnitName(m.org_unit_id) ?? "—"}</p>
                <p className="mt-2 text-xs text-muted">
                  Cycle {s?.cycleYear ? `Y${s.cycleYear} · ${s.cycleStatus}` : "—"} · {BRAND.assessmentShort} {s?.tnaStatus ?? "—"} · {BRAND.planShort} {s?.ildpStatus ?? "—"}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
