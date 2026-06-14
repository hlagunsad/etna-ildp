"use client";

import { useCallback, useEffect, useState } from "react";
import { loadReportData, type ReportData } from "@/lib/queries";
import {
  buildHeatmap,
  competencyRollup,
  departmentRollup,
  pickLatestYear,
  readinessDistribution,
  toCsv,
} from "@/lib/reporting";
import { useCan } from "../PermissionsProvider";
import { GAP_LABEL, GAP_TONE, READINESS_LABEL, READINESS_TONE, TONE_CELL } from "@/lib/labels";
import type { Role } from "@/lib/types";
import { Button, Card, EmptyState, PageHeader, Pill, Spinner } from "../ui";

export default function ReportsPanel({ role }: { role: Role | null }) {
  const can = useCan();
  const [data, setData] = useState<ReportData | null>(null);

  const load = useCallback(async () => {
    setData(await loadReportData());
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; setState runs after the awaited load, not a synchronous cascade
  useEffect(() => { load(); }, [load]);

  if (!data) return <Spinner label="Building report…" />;

  const org = can(role, "view_org");
  const title = org ? "Organization report" : "Team report";
  const subtitle = org
    ? "Competency gaps, readiness, and rollups across every validated cycle."
    : "Competency gaps and readiness across your direct reports.";

  const { columns, people } = buildHeatmap({
    snaps: data.snapshots,
    cycles: data.cycles,
    profiles: data.profiles,
    competencies: data.competencies,
    criticalByCompetency: data.criticalByCompetency,
    tnas: data.tnas,
    today: new Date().toISOString().slice(0, 10),
  });
  const latest = pickLatestYear(data.snapshots);
  const dist = readinessDistribution(people);
  const compRollup = competencyRollup(latest, data.competencies, data.criticalByCompetency);
  const deptRollup = departmentRollup(people);
  const criticalGaps = people.reduce((n, p) => n + p.criticalGapCount, 0);

  function exportCsv() {
    const headers = ["Person", "Department", "Readiness", ...columns.map((c) => c.name)];
    const rows = people.map((p) => [
      p.name,
      p.department ?? "Unassigned",
      READINESS_LABEL[p.readiness],
      ...p.cells.map((c) => (c ? c.label : "")),
    ]);
    const csv = "﻿" + toCsv(headers, rows); // BOM so Excel keeps accents
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `competency-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const actions = people.length > 0 && (
    <>
      <Button variant="secondary" size="sm" onClick={exportCsv}>Export CSV</Button>
      <Button variant="secondary" size="sm" onClick={() => window.print()}>Print / PDF</Button>
    </>
  );

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} actions={actions} />

      {people.length === 0 ? (
        <EmptyState title="No validated cycles yet">
          <p>Once a TNA is validated, gaps and readiness for {org ? "the organization" : "your team"} appear here.</p>
        </EmptyState>
      ) : (
        <div className="print-area space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="People in scope" value={people.length} />
            <Card className="p-4">
              <p className="text-xs font-medium text-muted">Readiness</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Pill tone={READINESS_TONE.on_track}>On Track {dist.on_track}</Pill>
                <Pill tone={READINESS_TONE.at_risk}>At Risk {dist.at_risk}</Pill>
                <Pill tone={READINESS_TONE.behind}>Behind {dist.behind}</Pill>
              </div>
            </Card>
            <Stat label="Open critical gaps" value={criticalGaps} />
          </div>

          <Card className="p-5 sm:p-6">
            <h2 className="mb-3 text-sm font-semibold text-muted">Competency gap heatmap</h2>
            <div className="overflow-x-auto">
              <table className="min-w-[40rem] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th scope="col" className="sticky left-0 z-10 bg-surface pb-2 pr-3 text-left text-xs font-medium uppercase tracking-wide text-faint">Person</th>
                    {columns.map((c) => (
                      <th key={c.id} scope="col" className="px-2 pb-2 text-center text-xs font-medium text-faint" title={c.name}>
                        <span className="mx-auto block max-w-[7rem] truncate">{c.name}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {people.map((p) => (
                    <tr key={p.userId}>
                      <th scope="row" className="sticky left-0 z-10 border-t border-line bg-surface py-2 pr-3 text-left align-top">
                        <span className="block font-medium text-ink">{p.name}</span>
                        <span className="mt-0.5 flex items-center gap-1.5">
                          <Pill tone={READINESS_TONE[p.readiness]}>{READINESS_LABEL[p.readiness]}</Pill>
                          {p.department && <span className="text-xs text-muted">{p.department}</span>}
                        </span>
                      </th>
                      {p.cells.map((cell, i) => (
                        <td key={columns[i].id} className="border-t border-line px-1 py-1.5 text-center">
                          {cell ? (
                            <span
                              className={`inline-block min-w-[3rem] rounded-md px-2 py-1 text-xs font-semibold tabular-nums ${TONE_CELL[GAP_TONE[cell.gapStatus]]}`}
                              title={`${columns[i].name}: ${cell.label} — ${GAP_LABEL[cell.gapStatus]}`}
                              aria-label={`${columns[i].name}: assessed ${cell.assessedRank ?? 0} of target ${cell.targetRank ?? "none"}, ${GAP_LABEL[cell.gapStatus]}`}
                            >
                              {cell.label}
                            </span>
                          ) : (
                            <span className="text-faint" aria-label={`${columns[i].name}: not targeted`}>—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted">Each cell shows assessed→target for the person&rsquo;s current cycle year; colour reflects the gap status.</p>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="mb-3 text-sm font-semibold text-muted">Gaps by competency</h2>
            {compRollup.length === 0 ? (
              <p className="text-sm text-muted">No open gaps — everyone is at or above target.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[30rem] text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-faint">
                      <th scope="col" className="pb-2 font-medium">Competency</th>
                      <th scope="col" className="pb-2 font-medium">People with a gap</th>
                      <th scope="col" className="pb-2 font-medium">Total gap</th>
                      <th scope="col" className="pb-2 font-medium">Critical</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compRollup.map((r) => (
                      <tr key={r.competencyId} className="border-t border-line">
                        <td className="py-2.5 font-medium text-ink">{r.name}</td>
                        <td className="py-2.5 tabular-nums text-muted">{r.peopleWithGap}</td>
                        <td className="py-2.5 tabular-nums text-muted">{r.gapSum}</td>
                        <td className="py-2.5">{r.isCritical && <Pill tone="danger">Critical</Pill>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="mb-3 text-sm font-semibold text-muted">By department</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-faint">
                    <th scope="col" className="pb-2 font-medium">Department</th>
                    <th scope="col" className="pb-2 font-medium">Headcount</th>
                    <th scope="col" className="pb-2 font-medium">On Track</th>
                    <th scope="col" className="pb-2 font-medium">At Risk</th>
                    <th scope="col" className="pb-2 font-medium">Behind</th>
                    <th scope="col" className="pb-2 font-medium">Open gaps</th>
                  </tr>
                </thead>
                <tbody>
                  {deptRollup.map((d) => (
                    <tr key={d.department} className="border-t border-line">
                      <td className="py-2.5 font-medium text-ink">{d.department}</td>
                      <td className="py-2.5 tabular-nums text-muted">{d.headcount}</td>
                      <td className="py-2.5 tabular-nums text-muted">{d.onTrack}</td>
                      <td className="py-2.5 tabular-nums text-muted">{d.atRisk}</td>
                      <td className="py-2.5 tabular-nums text-muted">{d.behind}</td>
                      <td className="py-2.5 tabular-nums text-muted">{d.openGaps}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-ink">{value}</p>
    </Card>
  );
}
