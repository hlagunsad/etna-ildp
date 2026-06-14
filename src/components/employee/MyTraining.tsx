"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { loadBoard, loadLookups } from "@/lib/queries";
import { Button, Card, EmptyState, PageHeader, Pill } from "../ui";
import type { Competency, IldpItem } from "@/lib/types";

type Resource = { id: string; title: string; provider: string | null; url: string | null; competency_id: string | null };
type Record_ = { id: string; ildp_item_id: string; status: string };

export default function MyTraining({ userId }: { userId: string }) {
  const [items, setItems] = useState<IldpItem[]>([]);
  const [comps, setComps] = useState<Record<string, Competency>>({});
  const [resources, setResources] = useState<Resource[]>([]);
  const [records, setRecords] = useState<Record_[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const sb = getSupabase();
    const [board, lk, { data: res }] = await Promise.all([
      loadBoard(userId),
      loadLookups(),
      sb.from("training_resource").select("id, title, provider, url, competency_id"),
    ]);
    setItems(board.items.filter((i) => i.gap_status !== "closed"));
    setComps(Object.fromEntries(lk.competencies.map((c) => [c.id, c])));
    setResources((res ?? []) as Resource[]);
    const { data: recs } = await sb.from("training_record").select("id, ildp_item_id, status").eq("user_id", userId);
    setRecords((recs ?? []) as Record_[]);
  }, [userId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; setState runs after the awaited load, not a synchronous cascade
  useEffect(() => { load(); }, [load]);

  async function logTraining(item: IldpItem, resourceId: string, status: string) {
    setBusy(true);
    const sb = getSupabase();
    const existing = records.find((r) => r.ildp_item_id === item.id);
    if (existing) {
      await sb.from("training_record").update({ status, completed_at: status === "completed" ? new Date().toISOString() : null }).eq("id", existing.id);
    } else {
      await sb.from("training_record").insert({ ildp_item_id: item.id, training_resource_id: resourceId, user_id: userId, status, completed_at: status === "completed" ? new Date().toISOString() : null });
    }
    await load();
    setBusy(false);
  }

  if (items.length === 0) {
    return <EmptyState title="Nothing to train right now"><p>You have no open development items.</p></EmptyState>;
  }

  return (
    <>
      <PageHeader title="My Training" subtitle="Free courses mapped to your open competency gaps. Mark progress; your supervisor verifies completion." />

      <div className="space-y-4">
        {items.map((item) => {
          const res = resources.filter((r) => r.competency_id === item.competency_id);
          const rec = records.find((r) => r.ildp_item_id === item.id);
          return (
            <Card key={item.id} className="p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium text-ink">{comps[item.competency_id]?.name ?? "—"}</p>
                {rec && <Pill tone="brand">{rec.status}</Pill>}
              </div>
              <ul className="mt-3 space-y-2.5">
                {res.length === 0 && <li className="text-sm text-muted">No mapped course yet.</li>}
                {res.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2.5 text-sm">
                    <span className="text-ink">{r.title}</span>
                    <Pill tone="neutral">{r.provider}</Pill>
                    {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="font-medium text-brand underline-offset-2 hover:underline">open ↗</a>}
                    <span className="ml-auto flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => logTraining(item, r.id, "in_progress")} disabled={busy}>Start</Button>
                      <Button size="sm" onClick={() => logTraining(item, r.id, "completed")} disabled={busy}>Mark completed</Button>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </>
  );
}
