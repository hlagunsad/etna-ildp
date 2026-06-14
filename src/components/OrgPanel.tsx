"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { loadLookups } from "@/lib/queries";
import { Button, Card, PageHeader, Spinner } from "./ui";

type Rollup = { name: string; count: number; totalPriority: number };

export default function OrgPanel() {
  const [ready, setReady] = useState(false);
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
    setReady(true);
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

  if (!ready) return <Spinner />;

  return (
    <>
      <PageHeader title="Organization" subtitle="Org-wide training-needs rollup and the final ILDP approval queue." />

      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Cycles" value={stats.cycles} />
          <Stat label="Validated TNAs" value={stats.validated} />
          <Stat label="Cycles passed" value={stats.passed} />
        </div>

        <Card className="p-5 sm:p-6">
          <h2 className="mb-3 text-sm font-semibold text-muted">Most-gapped competencies — who to train, on what</h2>
          {rollup.length === 0 ? (
            <p className="text-sm text-muted">No open gaps across the org.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[26rem] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-faint">
                    <th scope="col" className="pb-2 font-medium">Competency</th>
                    <th scope="col" className="pb-2 font-medium">People with a gap</th>
                    <th scope="col" className="pb-2 font-medium">Total priority</th>
                  </tr>
                </thead>
                <tbody>
                  {rollup.map((r) => (
                    <tr key={r.name} className="border-t border-line">
                      <td className="py-2.5 font-medium text-ink">{r.name}</td>
                      <td className="py-2.5 tabular-nums text-muted">{r.count}</td>
                      <td className="py-2.5 tabular-nums text-muted">{r.totalPriority}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="mb-3 text-sm font-semibold text-muted">ILDP approval queue</h2>
          {pending.length === 0 ? (
            <p className="text-sm text-muted">Nothing awaiting final approval.</p>
          ) : (
            <ul className="divide-y divide-line">
              {pending.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="text-ink">{p.user}</span>
                  <Button size="sm" onClick={() => approve(p.id)} disabled={busy}>Approve</Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="font-display text-2xl font-semibold tabular-nums text-ink">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </Card>
  );
}
