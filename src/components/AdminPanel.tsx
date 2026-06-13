"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { ROLE_LABEL } from "@/lib/labels";
import type { Profile } from "@/lib/types";

type Audit = { id: string; actor_email: string | null; action: string; entity_type: string; created_at: string };

export default function AdminPanel({ canUsers }: { canUsers: boolean }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);

  const load = useCallback(async () => {
    const sb = getSupabase();
    const [{ data: ps }, { data: a }] = await Promise.all([
      sb.from("profiles").select("id, full_name, email, role, manager_id, job_role_id, department, status"),
      sb.from("audit_log").select("id, actor_email, action, entity_type, created_at").order("created_at", { ascending: false }).limit(50),
    ]);
    setProfiles((ps ?? []) as Profile[]);
    setAudit((a ?? []) as Audit[]);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; setState runs after the awaited load, not a synchronous cascade
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      {canUsers && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">User accounts ({profiles.length})</h3>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-slate-400"><th className="pb-2">Name</th><th className="pb-2">Email</th><th className="pb-2">Role</th><th className="pb-2">Dept</th></tr></thead>
            <tbody>{profiles.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="py-2 font-medium text-slate-800">{p.full_name ?? "—"}</td>
                <td className="py-2 text-slate-600">{p.email}</td>
                <td className="py-2"><span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{ROLE_LABEL[p.role]}</span></td>
                <td className="py-2 text-slate-600">{p.department}</td>
              </tr>
            ))}</tbody>
          </table>
          <p className="mt-2 text-xs text-slate-400">Read-only in this MVP. Account creation runs through the admin API (the “no public sign-up” requirement) — seeded here by <code>npm run seed</code>.</p>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Audit log (immutable)</h3>
        {audit.length === 0 ? (
          <p className="text-sm text-slate-400">No audit entries yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-slate-400"><th className="pb-2">When</th><th className="pb-2">Actor</th><th className="pb-2">Action</th><th className="pb-2">Entity</th></tr></thead>
            <tbody>{audit.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="py-2 text-slate-500">{new Date(a.created_at).toLocaleString()}</td>
                <td className="py-2 text-slate-600">{a.actor_email}</td>
                <td className="py-2"><span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{a.action}</span></td>
                <td className="py-2 text-slate-600">{a.entity_type}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>
    </div>
  );
}
