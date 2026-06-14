"use client";

import { useCallback, useEffect, useState } from "react";
import { loadLibrary } from "@/lib/queries";
import { availableTargetCompetencies, levelsForScale } from "@/lib/library";
import { useCrud } from "@/lib/useCrud";
import type { CompetencyRow, JobRoleRow, ProficiencyLevel, RoleTarget } from "@/lib/types";
import { Button, Card, Field, Pill, inputClass } from "../ui";
import { ConfirmButton, EditorStatus, FormCard, ListCard } from "./EditorShell";

export default function JobRoleEditor() {
  const { rows: roles, loading, create, update, remove } = useCrud<JobRoleRow>(
    "job_role",
    "id, name, description, department",
    { orderBy: "name", unique: "A role with that name already exists.", fk: "Can't delete this role." },
  );
  const [comps, setComps] = useState<CompetencyRow[]>([]);
  const [levels, setLevels] = useState<ProficiencyLevel[]>([]);
  const [form, setForm] = useState({ name: "", department: "", description: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSiblings = useCallback(async () => {
    const lib = await loadLibrary();
    setComps(lib.competencies);
    setLevels(lib.levels);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; setState runs after the awaited load, not a synchronous cascade
  useEffect(() => { loadSiblings(); }, [loadSiblings]);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function resetForm() {
    setEditingId(null);
    setForm({ name: "", department: "", description: "" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setError(null);
    const payload = {
      name: form.name.trim(),
      department: form.department.trim() || null,
      description: form.description.trim() || null,
    };
    const res = editingId ? await update(editingId, payload) : await create(payload);
    if (res.ok) {
      setMsg(editingId ? "Saved." : `Added “${payload.name}”. Select it below to set competency targets.`);
      resetForm();
    } else {
      setError(res.error);
    }
    setBusy(false);
  }

  function edit(r: JobRoleRow) {
    setEditingId(r.id);
    setForm({ name: r.name ?? "", department: r.department ?? "", description: r.description ?? "" });
    setMsg(null);
    setError(null);
  }

  async function del(id: string) {
    setMsg(null);
    setError(null);
    const res = await remove(id);
    if (res.ok) {
      setMsg("Deleted.");
      if (editingId === id) resetForm();
      if (selectedId === id) setSelectedId(null);
    } else {
      setError(res.error);
    }
  }

  const selected = roles.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <FormCard
        title={editingId ? "Edit job role" : "Add job role"}
        hint="A role defines the competency targets an employee in it is measured against."
      >
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Role name" htmlFor="jr-name">
            <input id="jr-name" required className={inputClass} value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Department" htmlFor="jr-dept">
            <input id="jr-dept" className={inputClass} value={form.department} onChange={(e) => set("department", e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description" htmlFor="jr-desc">
              <textarea id="jr-desc" rows={2} className={inputClass} value={form.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : editingId ? "Save changes" : "Add role"}</Button>
            {editingId && (
              <Button type="button" variant="secondary" onClick={resetForm}>Cancel</Button>
            )}
            <EditorStatus msg={msg} error={error} />
          </div>
        </form>
      </FormCard>

      <ListCard title="Job roles" count={roles.length}>
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : roles.length === 0 ? (
          <p className="text-sm text-muted">No roles yet — add the first above.</p>
        ) : (
          <ul className="divide-y divide-line">
            {roles.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 first:pt-0 last:pb-0">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{r.name}</span>
                  {r.department && <span className="block truncate text-xs text-muted">{r.department}</span>}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant={selectedId === r.id ? "primary" : "secondary"}
                    size="sm"
                    aria-expanded={selectedId === r.id}
                    onClick={() => setSelectedId(selectedId === r.id ? null : r.id)}
                  >
                    {selectedId === r.id ? "Hide targets" : "Targets"}
                  </Button>
                  <button type="button" onClick={() => edit(r)} className="inline-flex min-h-9 items-center rounded-xl px-2.5 text-sm font-medium text-brand transition hover:bg-brand-50">Edit</button>
                  <ConfirmButton onConfirm={() => del(r.id)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </ListCard>

      {selected && <TargetsEditor key={selected.id} jobRoleId={selected.id} roleName={selected.name} comps={comps} levels={levels} />}
    </div>
  );
}

function TargetsEditor({
  jobRoleId,
  roleName,
  comps,
  levels,
}: {
  jobRoleId: string;
  roleName: string;
  comps: CompetencyRow[];
  levels: ProficiencyLevel[];
}) {
  const { rows, loading, create, update, remove } = useCrud<RoleTarget>(
    "role_competency_target",
    "id, job_role_id, competency_id, target_level_id, weight, is_critical",
    {
      filters: { job_role_id: jobRoleId },
      orderBy: "weight",
      ascending: false,
      unique: "That competency is already targeted for this role.",
      fk: "Can't remove this target.",
    },
  );
  const [form, setForm] = useState({ competency_id: "", target_level_id: "", weight: "1", is_critical: false });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const compById = (id: string) => comps.find((c) => c.id === id) ?? null;
  const levelById = (id: string) => levels.find((l) => l.id === id) ?? null;
  const available = availableTargetCompetencies(comps, rows);

  const editingRow = editingId ? rows.find((r) => r.id === editingId) ?? null : null;
  const activeCompId = editingRow ? editingRow.competency_id : form.competency_id;
  const activeComp = compById(activeCompId);
  const levelOptions = activeComp ? levelsForScale(activeComp.scale_id, levels) : [];

  function reset() {
    setEditingId(null);
    setForm({ competency_id: "", target_level_id: "", weight: "1", is_critical: false });
  }

  function editTarget(t: RoleTarget) {
    setEditingId(t.id);
    setForm({ competency_id: t.competency_id, target_level_id: t.target_level_id, weight: String(t.weight), is_critical: t.is_critical });
    setMsg(null);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setError(null);
    const weight = Number(form.weight) || 1;
    let res;
    if (editingId) {
      res = await update(editingId, { target_level_id: form.target_level_id, weight, is_critical: form.is_critical });
    } else {
      res = await create({
        job_role_id: jobRoleId,
        competency_id: form.competency_id,
        target_level_id: form.target_level_id,
        weight,
        is_critical: form.is_critical,
      });
    }
    if (res.ok) {
      setMsg(editingId ? "Saved." : "Target added.");
      reset();
    } else {
      setError(res.error);
    }
    setBusy(false);
  }

  async function del(id: string) {
    setMsg(null);
    setError(null);
    const res = await remove(id);
    if (res.ok) {
      setMsg("Removed.");
      if (editingId === id) reset();
    } else {
      setError(res.error);
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <h3 className="text-sm font-semibold text-ink">Competency targets for “{roleName}”</h3>
      <p className="mb-4 mt-1 text-xs text-muted">The level each competency must reach in this role. Critical targets drive the readiness signal.</p>

      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        {editingRow ? (
          <p className="text-sm text-muted sm:col-span-2">
            Editing target: <span className="font-medium text-ink">{activeComp?.name ?? "—"}</span>
          </p>
        ) : (
          <Field label="Competency" htmlFor="tg-comp">
            <select
              id="tg-comp"
              required
              className={inputClass}
              value={form.competency_id}
              onChange={(e) => setForm((f) => ({ ...f, competency_id: e.target.value, target_level_id: "" }))}
            >
              <option value="">— Competency —</option>
              {available.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Target level" htmlFor="tg-level">
          <select id="tg-level" required className={inputClass} value={form.target_level_id} onChange={(e) => setForm((f) => ({ ...f, target_level_id: e.target.value }))}>
            <option value="">— Level —</option>
            {levelOptions.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Weight" htmlFor="tg-weight" hint="Higher = more important in scoring.">
          <input id="tg-weight" type="number" min="1" className={inputClass} value={form.weight} onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-ink sm:col-span-2">
          <input type="checkbox" checked={form.is_critical} onChange={(e) => setForm((f) => ({ ...f, is_critical: e.target.checked }))} className="h-4 w-4 accent-brand" />
          Critical competency
        </label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit" disabled={busy || (!editingId && available.length === 0)}>{busy ? "Saving…" : editingId ? "Save" : "Add target"}</Button>
          {editingId && (
            <Button type="button" variant="secondary" onClick={reset}>Cancel</Button>
          )}
          {!editingId && available.length === 0 && <span className="text-xs text-muted">Every competency is already targeted.</span>}
          <EditorStatus msg={msg} error={error} />
        </div>
      </form>

      <div className="mt-4">
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted">No targets yet — add the first above.</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0">
                <span className="min-w-0 flex-1 truncate font-medium text-ink">{compById(t.competency_id)?.name ?? "—"}</span>
                <Pill tone="brand">{levelById(t.target_level_id)?.label ?? "—"}</Pill>
                <span className="text-xs tabular-nums text-muted">weight {t.weight}</span>
                {t.is_critical && <Pill tone="danger">Critical</Pill>}
                <button type="button" onClick={() => editTarget(t)} className="inline-flex min-h-9 items-center rounded-xl px-2.5 text-sm font-medium text-brand transition hover:bg-brand-50">Edit</button>
                <ConfirmButton onConfirm={() => del(t.id)} label="Remove" confirmLabel="Confirm remove" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
