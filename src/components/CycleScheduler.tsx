"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { apiPost } from "@/lib/api";
import { eligibleForCycle, isTnaOnTime } from "@/lib/cycle";
import { Button, Card, Field, PageHeader, Pill, Spinner, inputClass } from "./ui";
import { EditorStatus } from "./library/EditorShell";

type Profile = { id: string; full_name: string | null; department: string | null; job_role_id: string | null };
type Cycle = { id: string; user_id: string; current_year: number; status: string };
type Tna = { dev_cycle_id: string; cycle_year: number; status: string; due_date: string | null };
type ActionResult = { label: string; status: string; message?: string };

const STATUS_TONE: Record<string, "success" | "warn" | "danger" | "neutral"> = {
  opened: "success",
  advanced: "success",
  closed: "success",
  skipped: "warn",
  error: "danger",
};

export default function CycleScheduler() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [tnas, setTnas] = useState<Tna[]>([]);
  const [loading, setLoading] = useState(true);
  const [dept, setDept] = useState("");
  const [openDue, setOpenDue] = useState("");
  const [advanceDue, setAdvanceDue] = useState("");
  const [advanceArmed, setAdvanceArmed] = useState(false);
  const [busy, setBusy] = useState<null | "open" | "advance">(null);
  const [results, setResults] = useState<ActionResult[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = getSupabase();
    const [{ data: ps }, { data: cy }, { data: tn }] = await Promise.all([
      sb.from("profiles").select("id, full_name, department, job_role_id"),
      sb.from("dev_cycle").select("id, user_id, current_year, status"),
      sb.from("tna_assessment").select("dev_cycle_id, cycle_year, status, due_date"),
    ]);
    setProfiles((ps ?? []) as Profile[]);
    setCycles((cy ?? []) as Cycle[]);
    setTnas((tn ?? []) as Tna[]);
    setLoading(false);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; setState runs after the awaited load, not a synchronous cascade
  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner label="Loading cycles…" />;

  const cycleUserIds = new Set(cycles.map((c) => c.user_id));
  const eligible = eligibleForCycle(profiles, cycleUserIds);
  const withJobRole = profiles.filter((p) => p.job_role_id).length;
  const today = new Date().toISOString().slice(0, 10);

  const tnaByKey = new Map(tnas.map((t) => [`${t.dev_cycle_id}:${t.cycle_year}`, t]));
  let overdue = 0;
  for (const c of cycles) {
    const t = tnaByKey.get(`${c.id}:${c.current_year}`);
    if (t && !isTnaOnTime(t, today)) overdue += 1;
  }
  const byStatus = (s: string) => cycles.filter((c) => c.status === s).length;
  const activeByYear = (y: number) => cycles.filter((c) => c.current_year === y && c.status === "active").length;
  const departments = [...new Set(profiles.map((p) => p.department).filter((d): d is string => !!d))].sort();

  async function runOpen() {
    setBusy("open");
    setMsg(null);
    setError(null);
    setResults(null);
    try {
      const r = await apiPost("/api/cycles/bulk-open", { department: dept || undefined, dueDate: openDue || undefined });
      const res = (r.results as ActionResult[]) ?? [];
      setResults(res);
      if (res.length === 0) setMsg((r.message as string) ?? "Nothing to open.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
    setBusy(null);
  }

  async function runAdvance() {
    setAdvanceArmed(false);
    setBusy("advance");
    setMsg(null);
    setError(null);
    setResults(null);
    try {
      const r = await apiPost("/api/cycles/bulk-advance", { dueDate: advanceDue || undefined });
      const res = (r.results as ActionResult[]) ?? [];
      setResults(res);
      if (res.length === 0) setMsg((r.message as string) ?? "Nothing to advance.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
    setBusy(null);
  }

  return (
    <>
      <PageHeader title="Cycle scheduler" subtitle="Open development cycles org-wide, set TNA due dates, and advance the year in bulk." />

      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="With a job role" value={withJobRole} />
          <Stat label="Have a cycle" value={cycles.length} />
          <Stat label="Eligible to open" value={eligible.length} />
          <Stat label="Overdue TNAs" value={overdue} danger={overdue > 0} />
        </div>

        <Card className="p-4">
          <p className="text-xs font-medium text-muted">Cycles by year / outcome</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Pill tone="brand">Year 1: {activeByYear(1)}</Pill>
            <Pill tone="brand">Year 2: {activeByYear(2)}</Pill>
            <Pill tone="brand">Year 3: {activeByYear(3)}</Pill>
            <Pill tone="success">Passed: {byStatus("passed")}</Pill>
            <Pill tone="warn">Carry-over: {byStatus("carry_over")}</Pill>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-ink">Open cycles</h2>
          <p className="mb-4 mt-1 text-xs text-muted">Starts a baseline cycle + TNA for everyone with a job role and no cycle yet — {eligible.length} eligible now.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Department" htmlFor="cs-dept" hint="Optional — limit to one department.">
              <select id="cs-dept" className={inputClass} value={dept} onChange={(e) => setDept(e.target.value)}>
                <option value="">All departments</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="TNA due date" htmlFor="cs-open-due" hint="Optional — the submission deadline.">
              <input id="cs-open-due" type="date" className={inputClass} value={openDue} onChange={(e) => setOpenDue(e.target.value)} />
            </Field>
          </div>
          <div className="mt-4">
            <Button onClick={runOpen} disabled={busy !== null || eligible.length === 0}>
              {busy === "open" ? "Opening…" : `Open ${eligible.length} cycle${eligible.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-ink">Advance the year</h2>
          <p className="mb-4 mt-1 text-xs text-muted">Advances every active cycle to its next year (opens an annual TNA), or closes it at Year 3 with an outcome.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="New TNA due date" htmlFor="cs-adv-due" hint="Optional — deadline for the new round.">
              <input id="cs-adv-due" type="date" className={inputClass} value={advanceDue} onChange={(e) => setAdvanceDue(e.target.value)} />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {advanceArmed ? (
              <>
                <Button variant="danger" onClick={runAdvance} disabled={busy !== null}>Confirm — advance all active</Button>
                <Button variant="secondary" onClick={() => setAdvanceArmed(false)}>Cancel</Button>
              </>
            ) : (
              <Button variant="secondary" onClick={() => setAdvanceArmed(true)} disabled={busy !== null || byStatus("active") === 0}>
                Advance all active cycles
              </Button>
            )}
          </div>
        </Card>

        {(msg || error) && <div><EditorStatus msg={msg} error={error} /></div>}

        {results && results.length > 0 && (
          <Card className="p-5 sm:p-6">
            <h2 className="mb-3 text-sm font-semibold text-muted">Result ({results.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[26rem] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-faint">
                    <th scope="col" className="pb-2 font-medium">Person</th>
                    <th scope="col" className="pb-2 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="py-2 text-ink">{r.label}</td>
                      <td className="py-2">
                        <span className="flex flex-wrap items-center gap-2">
                          <Pill tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Pill>
                          {r.message && <span className="text-xs text-muted">{r.message}</span>}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}

function Stat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-1 font-display text-2xl font-semibold ${danger ? "text-danger" : "text-ink"}`}>{value}</p>
    </Card>
  );
}
