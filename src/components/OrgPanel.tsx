"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { loadLookups } from "@/lib/queries";

type Rollup = { name: string; count: number; totalPriority: number };

export default function OrgPanel() {
  const [rollup, setRollup] = useState<Rollup[]>([]);
  const [stats, setStats] = useState({ cycles: 0, validated: 0, passed: 0 });
  const [pending, setPending] = useState<{ id: string; user: string }[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const sb = getSupabase();
    const [lk, { data: items }, { data: cycles }, { data: tnas }, { data: pendingIldp }, { data: profiles }] = await Promise.all([
      loadLookups(),
      sb.from("ildp_item").select("competency_id, priority, gap_status"),
      sb.from("dev_cycle").select("status"),
      sb.from("tna_assessment").select("status"),
      sb.from("ildp").select("id, dev_cycle_id").eq("status", "pending_approval"),
      sb.from("profiles").select("id, full_name, email"),
    ]);

    const nameByComp = Object.fromEntries(lk.competencies.map((c) => [c.id, c.name]));
    const agg: Record<string, { count: number; totalPriority: number }> = {};
    for (const it of items ?? []) {
      if (it.gap_status === "closed") continue;
      (agg[it.competency_id] ??= { count: 0, totalPriority: 0 });
      agg[it.competency_id].count++;
      agg[it.competency_id].totalPriority += it.priority;
    }
    setRollup(
      Object.entries(agg)
        .map(([cid, v]) => ({ name: nameByComp[cid] ?? "—", ...v }))
        .sort((a, b) => b.totalPriority - a.totalPriority),
    );
    setStats({
      cycles: (cycles ?? []).length,
      validated: (tnas ?? []).filter((t) => t.status === "validated" || t.status === "finalized").length,
      passed: (cycles ?? []).filter((c) => c.status === "passed").length,
    });

    const nameById = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name ?? p.email]));
    const cycleIds = (pendingIldp ?? []).map((i) => i.dev_cycle_id);
    const { data: pcycles } = cycleIds.length
      ? await sb.from("dev_cycle").select("id, user_id").in("id", cycleIds)
      : { data: [] as { id: string; user_id: string }[] };
    const userByCycle = Object.fromEntries((pcycles ?? []).map((c) => [c.id, c.user_id]));
    setPending((pendingIldp ?? []).map((i) => ({ id: i.id, user: nameById[userByCycle[i.dev_cycle_id]] ?? "—" })));
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; setState runs after the awaited load, not a synchronous cascade
  useEffect(() => { load(); }, [load]);

  async function approve(id: string) {
    setBusy(true);
    const { data } = await getSupabase().auth.getSession();
    await getSupabase().from("ildp").update({ status: "active", approved_by: data.session?.user.id, approved_at: new Date().toISOString() }).eq("id", id);
    await load();
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Organization</h2>
        <p className="text-sm text-slate-500">Org-wide training-needs rollup and the final ILDP approval queue.</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Cycles" value={stats.cycles} />
        <Stat label="Validated TNAs" value={stats.validated} />
        <Stat label="Cycles passed" value={stats.passed} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Most-gapped competencies (who to train, on what)</h3>
        {rollup.length === 0 ? (
          <p className="text-sm text-slate-400">No open gaps across the org.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-slate-400"><th className="pb-2">Competency</th><th className="pb-2">People with a gap</th><th className="pb-2">Total priority</th></tr></thead>
            <tbody>{rollup.map((r) => (<tr key={r.name} className="border-t border-slate-100"><td className="py-2 font-medium text-slate-800">{r.name}</td><td className="py-2 text-slate-600">{r.count}</td><td className="py-2 text-slate-600">{r.totalPriority}</td></tr>))}</tbody>
          </table>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">ILDP approval queue</h3>
        {pending.length === 0 ? (
          <p className="text-sm text-slate-400">Nothing awaiting final approval.</p>
        ) : (
          <ul className="space-y-2">
            {pending.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{p.user}</span>
                <button onClick={() => approve(p.id)} disabled={busy} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">Approve</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
