"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { loadBoard, loadLookups, type Board } from "@/lib/queries";
import { GAP_CLASS, GAP_LABEL } from "@/lib/labels";
import type { Competency } from "@/lib/types";

const CHAIN = ["draft", "pending_endorsement", "pending_approval", "active"];
const CHAIN_LABEL: Record<string, string> = {
  draft: "Draft", pending_endorsement: "Endorsement", pending_approval: "Approval", active: "Active",
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

  if (!board) return <p className="text-sm text-slate-400">Loading…</p>;
  if (!board.ildp) return <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">No plan yet — complete and validate your TNA to generate one.</p>;

  const status = board.ildp.status;
  const currentStep = CHAIN.indexOf(status);
  const isOwner = userId === selfId;
  const sorted = [...board.items].sort((a, b) => b.priority - a.priority);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Individual Learning &amp; Development Plan</h2>
        <p className="text-sm text-slate-500">Approval chain: employee acknowledges → supervisor endorses → HR approves.</p>
      </div>

      <div className="flex items-center gap-2">
        {CHAIN.map((s, idx) => (
          <span key={s} className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${idx <= currentStep ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-400"}`}>{CHAIN_LABEL[s]}</span>
            {idx < CHAIN.length - 1 && <span className="text-slate-300">→</span>}
          </span>
        ))}
      </div>

      {isOwner && status === "draft" && (
        <div className="flex items-center gap-3">
          <button onClick={acknowledge} disabled={busy} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60">
            {busy ? "Acknowledging…" : "Acknowledge plan"}
          </button>
          <span className="text-sm text-slate-500">Confirm you have reviewed your plan to send it for endorsement.</span>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2">Competency</th><th className="pb-2">Gap</th><th className="pb-2">Priority</th><th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((i) => (
              <tr key={i.id} className="border-t border-slate-100">
                <td className="py-2 font-medium text-slate-800">{comps[i.competency_id]?.name ?? "—"}</td>
                <td className="py-2 text-slate-600">{i.gap_size}</td>
                <td className="py-2 text-slate-600">{i.priority}</td>
                <td className="py-2"><span className={`rounded px-2 py-0.5 text-xs font-medium ${GAP_CLASS[i.gap_status]}`}>{GAP_LABEL[i.gap_status]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
