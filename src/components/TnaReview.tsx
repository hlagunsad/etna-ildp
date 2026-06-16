"use client";

import { useCallback, useEffect, useState } from "react";
import { apiPost } from "@/lib/api";
import { Button, Card, Pill, Spinner, inputClass } from "./ui";

type Line = { competency_id: string; name: string; assessed_rank: number; target_rank: number; is_critical: boolean };

const RANK_LABEL: Record<number, string> = { 0: "Not yet", 1: "Basic", 2: "Intermediate", 3: "Advanced" };

// The supervisor's review-and-decide step. Shows the CALCULATED competency levels from a
// person's self-assessment (never their individual answers), lets the supervisor confirm or
// adjust each against what they know of the person's work, then validates to generate the plan.
export default function TnaReview({ tnaId, onValidated }: { tnaId: string; onValidated: () => void }) {
  const [lines, setLines] = useState<Line[] | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({}); // competency_id → supervisor-adjusted rank
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await apiPost(`/api/tna/${tnaId}/assessment`);
      setLines((r.lines as Line[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the assessment");
      setLines([]);
    }
  }, [tnaId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; setState runs after the awaited load, not a synchronous cascade
  useEffect(() => { load(); }, [load]);

  const rankOf = (l: Line) => ratings[l.competency_id] ?? l.assessed_rank;

  async function validate() {
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/api/tna/${tnaId}/validate`, { ratings }); // only the levels the supervisor changed
      onValidated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Validation failed");
      setBusy(false);
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-sm font-semibold text-ink">Review the assessment</h2>
      <p className="mb-4 mt-1 max-w-prose text-xs text-muted">
        These are the <strong>calculated</strong> competency levels from this person&rsquo;s self-assessment — not their individual answers, which stay private to them. Confirm each level against what you know of their work, adjust where you disagree, then validate to generate the plan.
      </p>
      {!lines ? (
        <Spinner label="Calculating…" />
      ) : lines.length === 0 ? (
        <p className="text-sm text-muted">This role has no competency targets to assess.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-faint">
                <th scope="col" className="pb-2 font-medium">Competency</th>
                <th scope="col" className="pb-2 font-medium">Assessed level</th>
                <th scope="col" className="pb-2 font-medium">Target</th>
                <th scope="col" className="pb-2 font-medium">Decision</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const rank = rankOf(l);
                const needsTraining = rank < l.target_rank;
                return (
                  <tr key={l.competency_id} className="border-t border-line align-top">
                    <td className="py-2.5 font-medium text-ink">
                      {l.name}
                      {l.is_critical && <span className="ml-1.5 align-middle"><Pill tone="danger">Critical</Pill></span>}
                    </td>
                    <td className="py-2.5">
                      <select
                        aria-label={`Assessed level for ${l.name}`}
                        className={`${inputClass} max-w-[11rem]`}
                        value={rank}
                        onChange={(e) => setRatings((r) => ({ ...r, [l.competency_id]: Number(e.target.value) }))}
                      >
                        {[0, 1, 2, 3].map((r) => <option key={r} value={r}>{RANK_LABEL[r]}</option>)}
                      </select>
                      {rank !== l.assessed_rank && (
                        <span className="mt-1 block text-[11px] text-faint">self-assessed: {RANK_LABEL[l.assessed_rank]}</span>
                      )}
                    </td>
                    <td className="py-2.5 text-muted">{RANK_LABEL[l.target_rank]}</td>
                    <td className="py-2.5">
                      {needsTraining ? <Pill tone="warn">Needs training</Pill> : <Pill tone="success">Already met</Pill>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={validate} disabled={busy || !lines}>{busy ? "Validating…" : "Validate & generate plan"}</Button>
        {error && <span role="alert" className="text-sm text-danger">{error}</span>}
      </div>
    </Card>
  );
}
