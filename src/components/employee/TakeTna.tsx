"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { loadBoard, loadLookups } from "@/lib/queries";
import { apiPost } from "@/lib/api";
import type { Competency, DevCycle, Level, Tna } from "@/lib/types";

type Item = { id: string; prompt_text: string; levelRank: number };

export default function TakeTna({ userId }: { userId: string }) {
  const [cycle, setCycle] = useState<DevCycle | null>(null);
  const [tna, setTna] = useState<Tna | null>(null);
  const [comps, setComps] = useState<Competency[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [itemsByComp, setItemsByComp] = useState<Record<string, Item[]>>({});
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = getSupabase();
    const [board, lk, { data: items }] = await Promise.all([
      loadBoard(userId),
      loadLookups(),
      sb.from("assessment_item").select("id, competency_id, prompt_text, level_id").eq("response_type", "yes_no"),
    ]);
    setCycle(board.cycle);
    setLevels(lk.levels);

    const rankByLevel = Object.fromEntries(lk.levels.map((l) => [l.id, l.rank]));
    const compById = Object.fromEntries(lk.competencies.map((c) => [c.id, c]));
    const snapIds = board.cycle ? board.cycle.snapshot_of_targets.map((t) => t.competencyId) : [];

    const grouped: Record<string, Item[]> = {};
    for (const it of items ?? []) {
      if (!snapIds.includes(it.competency_id)) continue;
      (grouped[it.competency_id] ??= []).push({
        id: it.id,
        prompt_text: it.prompt_text,
        levelRank: rankByLevel[it.level_id ?? ""] ?? 0,
      });
    }
    for (const cid of Object.keys(grouped)) grouped[cid].sort((a, b) => a.levelRank - b.levelRank);
    setItemsByComp(grouped);
    setComps(snapIds.map((id) => compById[id]).filter(Boolean));

    const current = board.cycle ? board.tnas.find((t) => t.cycle_year === board.cycle!.current_year) ?? null : null;
    setTna(current);
    if (current) {
      const { data: responses } = await sb.from("tna_response").select("item_id, raw_answer").eq("tna_assessment_id", current.id);
      setChecked(new Set((responses ?? []).filter((r) => r.raw_answer === "yes").map((r) => r.item_id)));
    }
  }, [userId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; setState runs after the awaited load, not a synchronous cascade
  useEffect(() => { load(); }, [load]);

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
    const rows = comps.flatMap((c) =>
      (itemsByComp[c.id] ?? []).map((it) => ({
        tna_assessment_id: tna.id,
        item_id: it.id,
        raw_answer: checked.has(it.id) ? "yes" : "no",
        derived_level_id: null,
      })),
    );
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
        {tna?.status === "submitted" && "Your TNA is submitted and awaiting validation by your supervisor."}
        {(tna?.status === "validated" || tna?.status === "finalized") && `Your Year ${tna.cycle_year} TNA is validated. Check My Development for your gaps.`}
        {!tna && "No open TNA for this year yet."}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Training Needs Analysis — Year {tna.cycle_year}</h2>
        <p className="text-sm text-slate-500">Check every statement you can already do. Your proficiency level for each competency is worked out from your answers.</p>
      </div>

      {comps.map((c) => {
        const items = itemsByComp[c.id] ?? [];
        return (
          <div key={c.id} data-testid="tna-comp" data-comp-id={c.id} className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="font-display font-semibold text-slate-800">{c.name}</h3>
            {[1, 2, 3].map((rank) => {
              const levelItems = items.filter((it) => it.levelRank === rank);
              if (levelItems.length === 0) return null;
              const label = levels.find((l) => l.rank === rank)?.label ?? "";
              return (
                <div key={rank} className="mt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                  <div className="mt-1.5 space-y-1.5">
                    {levelItems.map((it) => (
                      <label key={it.id} className="flex items-start gap-2.5 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          data-testid="tna-item"
                          data-comp-id={c.id}
                          data-level={rank}
                          checked={checked.has(it.id)}
                          onChange={() => toggle(it.id)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-200"
                        />
                        <span>{it.prompt_text}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      <div className="flex items-center gap-3">
        <button onClick={() => persist(false)} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">Save draft</button>
        <button onClick={() => persist(true)} disabled={busy} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60">Submit for validation</button>
        {msg && <span className="text-sm text-emerald-600">{msg}</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}
