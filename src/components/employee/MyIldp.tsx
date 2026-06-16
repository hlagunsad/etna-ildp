"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { loadBoard, loadLookups, type Board } from "@/lib/queries";
import { GAP_LABEL, GAP_TONE } from "@/lib/labels";
import { Button, Card, EmptyState, PageHeader, Pill, Spinner } from "../ui";
import type { Competency } from "@/lib/types";
import { BRAND } from "@/lib/brand";

const CHAIN = ["draft", "pending_endorsement", "pending_approval", "active"];
const CHAIN_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_endorsement: "Endorsement",
  pending_approval: "Approval",
  active: "Active",
};

export default function MyIldp({ userId, selfId }: { userId: string; selfId: string }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [comps, setComps] = useState<Record<string, Competency>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [b, lk] = await Promise.all([loadBoard(userId), loadLookups()]);
    setBoard(b);
    setComps(Object.fromEntries(lk.competencies.map((c) => [c.id, c])));
  }, [userId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; setState runs after the awaited load, not a synchronous cascade
  useEffect(() => { load(); }, [load]);

  async function acknowledge() {
    if (!board?.ildp) return;
    setBusy(true); setError(null);
    const { error } = await getSupabase()
      .from("ildp")
      .update({ status: "pending_endorsement", acknowledged_by: selfId, acknowledged_at: new Date().toISOString() })
      .eq("id", board.ildp.id);
    if (error) setError(error.message);
    else await load();
    setBusy(false);
  }

  if (!board) return <Spinner />;
  if (!board.ildp) return <EmptyState title="No plan yet"><p>Complete and validate your {BRAND.assessment} to generate your plan.</p></EmptyState>;

  const status = board.ildp.status;
  const currentStep = CHAIN.indexOf(status);
  const isOwner = userId === selfId;
  const sorted = [...board.items].sort((a, b) => b.priority - a.priority);

  return (
    <>
      <PageHeader title={BRAND.plan} subtitle="Approval chain: employee acknowledges → supervisor endorses → HR approves." />

      <div className="space-y-5">
        <Card className="p-5">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
            {CHAIN.map((s, idx) => (
              <li key={s} className="flex items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${idx <= currentStep ? "bg-brand-50 text-brand" : "bg-chip text-faint"}`}>
                  {CHAIN_LABEL[s]}
                </span>
                {idx < CHAIN.length - 1 && <span aria-hidden className="text-faint">→</span>}
              </li>
            ))}
          </ol>
        </Card>

        {isOwner && status === "draft" && (
          <Card className="flex flex-wrap items-center gap-3 p-5">
            <Button onClick={acknowledge} disabled={busy}>{busy ? "Acknowledging…" : "Acknowledge plan"}</Button>
            <span className="text-sm text-muted">Confirm you have reviewed your plan to send it for endorsement.</span>
          </Card>
        )}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}

        <Card className="p-5 sm:p-6">
          <h2 className="mb-3 text-sm font-semibold text-muted">Plan items</h2>
          <ul className="divide-y divide-line">
            {sorted.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
                <span className="min-w-0 flex-1 truncate font-medium text-ink">{comps[i.competency_id]?.name ?? "—"}</span>
                <span className="text-xs tabular-nums text-muted">Gap {i.gap_size} · Priority {i.priority}</span>
                <Pill tone={GAP_TONE[i.gap_status]}>{GAP_LABEL[i.gap_status]}</Pill>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
