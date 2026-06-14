"use client";

import { useCallback, useEffect, useState } from "react";
import { loadBoard, loadLookups, type Board } from "@/lib/queries";
import { cycleReadiness } from "@/lib/readiness";
import { apiPost } from "@/lib/api";
import { GAP_LABEL, GAP_TONE, READINESS_LABEL, READINESS_TONE } from "@/lib/labels";
import { Button, Card, EmptyState, PageHeader, Pill, Spinner } from "../ui";
import type { Competency, Readiness } from "@/lib/types";

function rankLabel(rank: number | undefined): string {
  return rank === 1 ? "Basic" : rank === 2 ? "Intermediate" : rank === 3 ? "Advanced" : "—";
}

export default function EmployeeDashboard({ userId, self, embedded }: { userId: string; self?: boolean; embedded?: boolean }) {
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

  if (!board) return <Spinner />;

  if (!board.cycle) {
    return (
      <EmptyState title="No development cycle yet">
        <p>
          {self
            ? "Start your baseline Training Needs Analysis to measure your current levels against your role's targets and generate your plan."
            : "This person has not started their baseline TNA yet."}
        </p>
        {self && (
          <div className="mt-4">
            <Button onClick={startBaseline} disabled={busy}>{busy ? "Starting…" : "Start baseline TNA"}</Button>
          </div>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      </EmptyState>
    );
  }

  const criticalSet = new Set(board.cycle.snapshot_of_targets.filter((t) => t.isCritical).map((t) => t.competencyId));
  const readiness: Readiness = cycleReadiness({
    items: board.items.map((i) => ({ isCritical: criticalSet.has(i.competency_id), status: i.gap_status })),
    tnaOnTimeThisYear: true,
  });
  const sortedItems = [...board.items].sort((a, b) => b.priority - a.priority);

  const byComp: Record<string, Record<number, number | null>> = {};
  for (const s of board.snapshots) (byComp[s.competency_id] ??= {})[s.cycle_year] = s.assessed_rank;

  return (
    <>
      {embedded ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted">Cycle year {board.cycle.current_year} of 3 · plan {board.ildp?.status ?? "—"}</p>
          <Pill tone={READINESS_TONE[readiness]}>{READINESS_LABEL[readiness]}</Pill>
        </div>
      ) : (
        <PageHeader
          title="My Development"
          subtitle={`Cycle year ${board.cycle.current_year} of 3 · plan ${board.ildp?.status ?? "—"}`}
          actions={<Pill tone={READINESS_TONE[readiness]}>{READINESS_LABEL[readiness]}</Pill>}
        />
      )}

      <div className="space-y-5">
        <Card className="p-5 sm:p-6">
          <h2 className="mb-3 text-sm font-semibold text-muted">Competency gaps, by priority</h2>
          {sortedItems.length === 0 ? (
            <p className="text-sm text-muted">No plan items yet — complete and validate your TNA.</p>
          ) : (
            <ul className="divide-y divide-line">
              {sortedItems.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 font-medium text-ink">
                      <span className="truncate">{comps[i.competency_id]?.name ?? "—"}</span>
                      {criticalSet.has(i.competency_id) && <Pill tone="danger">Critical</Pill>}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {rankLabel(rankByLevel[i.current_level_id ?? ""])} → {rankLabel(rankByLevel[i.target_level_id ?? ""])}
                    </p>
                  </div>
                  <span className="text-xs tabular-nums text-muted">Priority {i.priority}</span>
                  <Pill tone={GAP_TONE[i.gap_status]}>{GAP_LABEL[i.gap_status]}</Pill>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="mb-3 text-sm font-semibold text-muted">3-year trend — assessed level per year</h2>
          {Object.keys(byComp).length === 0 ? (
            <p className="text-sm text-muted">A trend appears once at least one year is assessed.</p>
          ) : (
            <ul className="space-y-2.5">
              {Object.entries(byComp).map(([cid, years]) => (
                <li key={cid} className="grid grid-cols-1 gap-1.5 sm:grid-cols-[13rem_1fr] sm:items-center sm:gap-3">
                  <span className="truncate text-sm text-ink">{comps[cid]?.name ?? "—"}</span>
                  <div className="flex items-center gap-3">
                    {[1, 2, 3].map((y) => (
                      <span key={y} className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-faint">Y{y}</span>
                        <span aria-hidden className="h-2 w-12 overflow-hidden rounded-full bg-chip sm:w-16">
                          <span className="block h-full rounded-full bg-brand" style={{ width: `${((years[y] ?? 0) / 3) * 100}%` }} />
                        </span>
                        <span className="w-3 text-xs tabular-nums text-muted">{years[y] ?? "—"}</span>
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
