"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { loadBoard, loadLookups } from "@/lib/queries";
import { apiPost } from "@/lib/api";
import type { Competency, DevCycle, Level, Tna } from "@/lib/types";

export default function TakeTna({ userId }: { userId: string }) {
  const [cycle, setCycle] = useState<DevCycle | null>(null);
  const [tna, setTna] = useState<Tna | null>(null);
  const [comps, setComps] = useState<Competency[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [itemByComp, setItemByComp] = useState<Record<string, string>>({});
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = getSupabase();
    const [board, lk, { data: items }] = await Promise.all([
      loadBoard(userId),
      loadLookups(),
      sb.from("assessment_item").select("id, competency_id"),
    ]);
    setCycle(board.cycle);
    setLevels(lk.levels);
    const byId = Object.fromEntries(lk.competencies.map((c) => [c.id, c]));
    setItemByComp(Object.fromEntries((items ?? []).map((i) => [i.competency_id, i.id])));

    const current = board.cycle ? board.tnas.find((t) => t.cycle_year === board.cycle!.current_year) ?? null : null;
    setTna(current);
    setComps(board.cycle ? board.cycle.snapshot_of_targets.map((t) => byId[t.competencyId]).filter(Boolean) : []);

    if (current) {
      const { data: responses } = await sb.from("tna_response").select("item_id, raw_answer").eq("tna_assessment_id", current.id);
      const itemToComp = Object.fromEntries((items ?? []).map((i) => [i.id, i.competency_id]));
      const r: Record<string, number> = {};
      for (const resp of responses ?? []) {
        const cid = itemToComp[resp.item_id];
        if (cid && resp.raw_answer) r[cid] = Number(resp.raw_answer);
      }
      setRatings(r);
    }
  }, [userId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; setState runs after the awaited load, not a synchronous cascade
  useEffect(() => { load(); }, [load]);

  async function startBaseline() {
    setBusy(true); setError(null);
    try { await apiPost("/api/cycle/start"); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    setBusy(false);
  }

  async function persist(submit: boolean) {
    if (!tna) return;
    setBusy(true); setError(null); setMsg(null);
    const sb = getSupabase();
    const rankToLevel = Object.fromEntries(levels.map((l) => [l.rank, l.id]));
    const rows = comps
      .filter((c) => ratings[c.id])
      .map((c) => ({
        tna_assessment_id: tna.id,
        item_id: itemByComp[c.id],
        raw_answer: String(ratings[c.id]),
        derived_level_id: rankToLevel[ratings[c.id]],
      }));
    const { error: rErr } = await sb.from("tna_response").upsert(rows, { onConflict: "tna_assessment_id,item_id" });
    if (rErr) { setError(rErr.message); setBusy(false); return; }
    const { error: sErr } = await sb
      .from("tna_assessment")
      .update(submit ? { status: "submitted", submitted_at: new Date().toISOString() } : { status: "in_progress" })
      .eq("id", tna.id);
    if (sErr) { setError(sErr.message); setBusy(false); return; }
    setMsg(submit ? "Submitted for validation." : "Saved.");
    await load();
    setBusy(false);
  }

  if (!cycle) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h2 className="text-lg font-semibold text-slate-900">Start your baseline TNA</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">This locks your target levels for the 3-year cycle and opens your first self-assessment.</p>
        <button onClick={startBaseline} disabled={busy} className="mt-4 rounded-lg bg-sky-600 px-5 py-2.5 font-semibold text-white hover:bg-sky-700 disabled:opacity-60">
          {busy ? "Starting…" : "Start baseline TNA"}
        </button>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  if (!tna || tna.status === "submitted" || tna.status === "validated" || tna.status === "finalized") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
        {tna?.status === "submitted" && "Your TNA is submitted and awaiting your supervisor's validation."}
        {(tna?.status === "validated" || tna?.status === "finalized") && `Your Year ${tna.cycle_year} TNA is validated. Check My Development for your gaps.`}
        {!tna && "No open TNA for this year yet."}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Training Needs Analysis — Year {tna.cycle_year}</h2>
        <p className="text-sm text-slate-500">Rate your current proficiency for each competency your role requires.</p>
      </div>
      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
        {comps.map((c) => (
          <div key={c.id} data-testid="tna-row" className="flex flex-wrap items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-800">{c.name}</p>
              <p className="truncate text-xs text-slate-400">{c.description}</p>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3].map((r) => (
                <button
                  key={r}
                  onClick={() => setRatings((p) => ({ ...p, [c.id]: r }))}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    ratings[c.id] === r ? "border-sky-500 bg-sky-50 text-sky-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {r === 1 ? "Basic" : r === 2 ? "Intermediate" : "Advanced"}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={() => persist(false)} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">Save draft</button>
        <button onClick={() => persist(true)} disabled={busy || comps.some((c) => !ratings[c.id])} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60">Submit for validation</button>
        {msg && <span className="text-sm text-emerald-600">{msg}</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}
