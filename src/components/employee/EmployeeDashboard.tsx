"use client";

import { useCallback, useEffect, useState } from "react";
import { loadBoard, loadLookups, type Board } from "@/lib/queries";
import { cycleReadiness } from "@/lib/readiness";
import { apiPost } from "@/lib/api";
import { GAP_CLASS, GAP_LABEL, READINESS_CLASS, READINESS_LABEL } from "@/lib/labels";
import type { Competency, Readiness } from "@/lib/types";

export default function EmployeeDashboard({ userId, self }: { userId: string; self?: boolean }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [comps, setComps] = useState<Record<string, Competency>>({});
  const [rankByLevel, setRankByLevel] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [b, lk] = await Promise.all([loadBoard(userId), loadLookups()]);
    setBoard(b);
    setComps(Object.fromEntries(lk.competencies.map((c) => [c.id, c])));
    setRankByLevel(Object.fromEntries(lk.levels.map((l) => [l.id, l.rank])));
  }, [userId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; setState runs after the awaited load, not a synchronous cascade
  useEffect(() => { load(); }, [load]);

  async function startBaseline() {
    setBusy(true); setError(null);
    try { await apiPost("/api/cycle/start"); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    setBusy(false);
  }

  if (!board) return <p className="text-sm text-slate-400">Loading…</p>;

  if (!board.cycle) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h2 className="text-lg font-semibold text-slate-900">No development cycle yet</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
          {self
            ? "Start your baseline Training Needs Analysis to measure your current levels against your role's targets and generate your plan."
            : "This person has not started their baseline TNA yet."}
        </p>
        {self && (
          <button onClick={startBaseline} disabled={busy} className="mt-4 rounded-lg bg-sky-600 px-5 py-2.5 font-semibold text-white hover:bg-sky-700 disabled:opacity-60">
            {busy ? "Starting…" : "Start baseline TNA"}
          </button>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  const criticalSet = new Set(board.cycle.snapshot_of_targets.filter((t) => t.isCritical).map((t) => t.competencyId));
  const readiness: Readiness = cycleReadiness({
    items: board.items.map((i) => ({ isCritical: criticalSet.has(i.competency_id), status: i.gap_status })),
    tnaOnTimeThisYear: true,
  });
  const sortedItems = [...board.items].sort((a, b) => b.priority - a.priority);

  // Trend: competency → { year → assessedRank }.
  const byComp: Record<string, Record<number, number | null>> = {};
  for (const s of board.snapshots) {
    (byComp[s.competency_id] ??= {})[s.cycle_year] = s.assessed_rank;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">My Development</h2>
          <p className="text-sm text-slate-500">
            Cycle year {board.cycle.current_year} of 3 · plan status{" "}
            <span className="font-medium text-slate-700">{board.ildp?.status ?? "—"}</span>
          </p>
        </div>
        <span className={`ml-auto rounded-full px-3 py-1 text-sm font-semibold ring-1 ${READINESS_CLASS[readiness]}`}>
          {READINESS_LABEL[readiness]}
        </span>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Competency gaps (by priority)</h3>
        {sortedItems.length === 0 ? (
          <p className="text-sm text-slate-400">No plan items yet — complete and validate your TNA.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2">Competency</th><th className="pb-2">Current → Target</th>
                <th className="pb-2">Gap</th><th className="pb-2">Priority</th><th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((i) => (
                <tr key={i.id} className="border-t border-slate-100">
                  <td className="py-2 font-medium text-slate-800">
                    {comps[i.competency_id]?.name ?? "—"}
                    {criticalSet.has(i.competency_id) && <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">CRITICAL</span>}
                  </td>
                  <td className="py-2 text-slate-600">
                    {rankLabel(rankByLevel[i.current_level_id ?? ""])} → {rankLabel(rankByLevel[i.target_level_id ?? ""])}
                  </td>
                  <td className="py-2 text-slate-600">{i.gap_size}</td>
                  <td className="py-2 text-slate-600">{i.priority}</td>
                  <td className="py-2"><span className={`rounded px-2 py-0.5 text-xs font-medium ${GAP_CLASS[i.gap_status]}`}>{GAP_LABEL[i.gap_status]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">3-year trend (assessed level per year)</h3>
        {Object.keys(byComp).length === 0 ? (
          <p className="text-sm text-slate-400">A trend appears once at least one year is assessed.</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(byComp).map(([cid, years]) => (
              <div key={cid} className="flex items-center gap-3 text-sm">
                <span className="w-56 shrink-0 truncate text-slate-700">{comps[cid]?.name ?? "—"}</span>
                {[1, 2, 3].map((y) => (
                  <span key={y} className="flex items-center gap-1">
                    <span className="text-xs text-slate-400">Y{y}</span>
                    <span className="inline-block h-2 rounded bg-sky-500" style={{ width: `${(years[y] ?? 0) * 18}px` }} />
                    <span className="w-3 text-xs text-slate-500">{years[y] ?? "—"}</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function rankLabel(rank: number | undefined): string {
  return rank === 1 ? "Basic" : rank === 2 ? "Intermediate" : rank === 3 ? "Advanced" : "—";
}
