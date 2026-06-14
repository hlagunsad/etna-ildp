"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { loadBoard, loadLookups } from "@/lib/queries";
import { apiPost } from "@/lib/api";
import { Button, Card, EmptyState, PageHeader } from "../ui";
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
      (grouped[it.competency_id] ??= []).push({ id: it.id, prompt_text: it.prompt_text, levelRank: rankByLevel[it.level_id ?? ""] ?? 0 });
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
      <EmptyState title="Start your baseline TNA">
        <p>This locks your target levels for the 3-year cycle and opens your first self-assessment.</p>
        <div className="mt-4">
          <Button onClick={startBaseline} disabled={busy}>{busy ? "Starting…" : "Start baseline TNA"}</Button>
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      </EmptyState>
    );
  }

  if (!tna || tna.status === "submitted" || tna.status === "validated" || tna.status === "finalized") {
    return (
      <Card className="p-8 text-center text-sm text-muted">
        {tna?.status === "submitted" && "Your TNA is submitted and awaiting validation by your supervisor."}
        {(tna?.status === "validated" || tna?.status === "finalized") && `Your Year ${tna.cycle_year} TNA is validated. Check My Development for your gaps.`}
        {!tna && "No open TNA for this year yet."}
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title={`Training Needs Analysis — Year ${tna.cycle_year}`}
        subtitle="Check every statement you can already do. Your level for each competency is worked out from your answers."
      />

      <div className="space-y-4">
        {comps.map((c) => {
          const items = itemsByComp[c.id] ?? [];
          return (
            <Card key={c.id} data-testid="tna-comp" data-comp-id={c.id} className="p-5 sm:p-6">
              <h2 className="font-display text-lg font-semibold text-ink">{c.name}</h2>
              {[1, 2, 3].map((rank) => {
                const levelItems = items.filter((it) => it.levelRank === rank);
                if (levelItems.length === 0) return null;
                const label = levels.find((l) => l.rank === rank)?.label ?? "";
                return (
                  <fieldset key={rank} className="mt-4">
                    <legend className="text-[11px] font-semibold uppercase tracking-wide text-faint">{label}</legend>
                    <div className="mt-1.5 space-y-1">
                      {levelItems.map((it) => (
                        <label key={it.id} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl px-2 py-1.5 text-sm text-ink hover:bg-brand-50">
                          <input
                            type="checkbox"
                            data-testid="tna-item"
                            data-comp-id={c.id}
                            data-level={rank}
                            checked={checked.has(it.id)}
                            onChange={() => toggle(it.id)}
                            className="mt-0.5 h-5 w-5 shrink-0 rounded border-line accent-brand"
                          />
                          <span>{it.prompt_text}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                );
              })}
            </Card>
          );
        })}
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 mt-4 flex flex-wrap items-center gap-3 border-t border-line bg-bg/90 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <Button variant="secondary" onClick={() => persist(false)} disabled={busy}>Save draft</Button>
        <Button onClick={() => persist(true)} disabled={busy}>Submit for validation</Button>
        {msg && <span className="text-sm font-medium text-success" role="status">{msg}</span>}
        {error && <span className="text-sm text-danger" role="alert">{error}</span>}
      </div>
    </>
  );
}
