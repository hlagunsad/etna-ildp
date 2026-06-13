"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { loadBoard, loadLookups } from "@/lib/queries";
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
    return <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">No open development items — nothing to train right now.</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900">My Training</h2>
        <p className="text-sm text-slate-500">Free courses mapped to your open competency gaps. Mark progress; your supervisor verifies completion.</p>
      </div>
      {items.map((item) => {
        const res = resources.filter((r) => r.competency_id === item.competency_id);
        const rec = records.find((r) => r.ildp_item_id === item.id);
        return (
          <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="font-medium text-slate-800">{comps[item.competency_id]?.name ?? "—"}</p>
              {rec && <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{rec.status}</span>}
            </div>
            <ul className="mt-2 space-y-2">
              {res.length === 0 && <li className="text-sm text-slate-400">No mapped course yet.</li>}
              {res.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-slate-700">{r.title}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase text-slate-500">{r.provider}</span>
                  {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="text-sky-600 hover:underline">open ↗</a>}
                  <button onClick={() => logTraining(item, r.id, "in_progress")} disabled={busy} className="ml-auto rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">Start</button>
                  <button onClick={() => logTraining(item, r.id, "completed")} disabled={busy} className="rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700">Mark completed</button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
