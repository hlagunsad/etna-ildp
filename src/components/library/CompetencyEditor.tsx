"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadLibrary } from "@/lib/queries";
import { levelsForScale, missingDescriptors } from "@/lib/library";
import { useCrud } from "@/lib/useCrud";
import { COMP_GROUPS, type CompetencyRow, type LevelDescriptor, type ProficiencyLevel, type Scale } from "@/lib/types";
import { Button, Card, Field, Pill, inputClass } from "../ui";
import { ConfirmButton, EditorStatus, FormCard, ListCard } from "./EditorShell";

const EMPTY = { code: "", name: "", description: "", category: "", comp_group: "", scale_id: "" };
const SELECT = "id, code, name, description, category, comp_group, scale_id";

export default function CompetencyEditor() {
  const { rows, loading, create, update, remove } = useCrud<CompetencyRow>("competency", SELECT, {
    orderBy: "code",
    unique: "A competency with that code already exists.",
    fk: "Can't delete — this competency is used in a TNA, plan, result, or role target.",
  });
  const [scales, setScales] = useState<Scale[]>([]);
  const [levels, setLevels] = useState<ProficiencyLevel[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSiblings = useCallback(async () => {
    const lib = await loadLibrary();
    setScales(lib.scales);
    setLevels(lib.levels);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; setState runs after the awaited load, not a synchronous cascade
  useEffect(() => { loadSiblings(); }, [loadSiblings]);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY });
  }

  function edit(c: CompetencyRow) {
    setEditingId(c.id);
    setForm({
      code: c.code ?? "",
      name: c.name ?? "",
      description: c.description ?? "",
      category: c.category ?? "",
      comp_group: c.comp_group ?? "",
      scale_id: c.scale_id ?? "",
    });
    setMsg(null);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setError(null);
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category.trim() || null,
      comp_group: form.comp_group || null,
      scale_id: form.scale_id,
    };
    const res = editingId ? await update(editingId, payload) : await create(payload);
    if (res.ok) {
      setMsg(editingId ? "Saved." : `Added “${payload.code}”. Select it below to add level indicators.`);
      resetForm();
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
      setMsg("Deleted.");
      if (editingId === id) resetForm();
    } else {
      setError(res.error);
    }
  }

  const scaleName = (id: string) => scales.find((s) => s.id === id)?.name ?? "—";
  const editingRow = editingId ? rows.find((r) => r.id === editingId) ?? null : null;
  const editingScaleLevels = editingRow ? levelsForScale(editingRow.scale_id, levels) : [];

  return (
    <div className="space-y-6">
      <FormCard
        title={editingId ? "Edit competency" : "Add competency"}
        hint="A competency is one skill area measured on a scale. Code is the short unique key (e.g. CYB)."
      >
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Code" htmlFor="cmp-code">
            <input id="cmp-code" required className={inputClass} value={form.code} onChange={(e) => set("code", e.target.value)} />
          </Field>
          <Field label="Name" htmlFor="cmp-name">
            <input id="cmp-name" required className={inputClass} value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Group" htmlFor="cmp-group">
            <select id="cmp-group" className={inputClass} value={form.comp_group} onChange={(e) => set("comp_group", e.target.value)}>
              <option value="">— Group —</option>
              {COMP_GROUPS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </Field>
          <Field label="Category" htmlFor="cmp-cat" hint="Optional grouping label.">
            <input id="cmp-cat" className={inputClass} value={form.category} onChange={(e) => set("category", e.target.value)} />
          </Field>
          <Field label="Scale" htmlFor="cmp-scale">
            <select id="cmp-scale" required className={inputClass} value={form.scale_id} onChange={(e) => set("scale_id", e.target.value)}>
              <option value="">— Scale —</option>
              {scales.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description" htmlFor="cmp-desc">
              <textarea id="cmp-desc" rows={2} className={inputClass} value={form.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : editingId ? "Save changes" : "Add competency"}</Button>
            {editingId && (
              <Button type="button" variant="secondary" onClick={resetForm}>Cancel</Button>
            )}
            <EditorStatus msg={msg} error={error} />
          </div>
        </form>
      </FormCard>

      {editingRow && (
        <DescriptorsEditor key={editingRow.id} competencyId={editingRow.id} scaleLevels={editingScaleLevels} />
      )}

      <ListCard title="Competencies" count={rows.length}>
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted">No competencies yet — add the first above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-faint">
                  <th scope="col" className="pb-2 font-medium">Code</th>
                  <th scope="col" className="pb-2 font-medium">Name</th>
                  <th scope="col" className="pb-2 font-medium">Group</th>
                  <th scope="col" className="pb-2 font-medium">Scale</th>
                  <th scope="col" className="pb-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-t border-line">
                    <td className="py-2.5 font-mono text-xs font-semibold text-ink">{c.code}</td>
                    <td className="py-2.5 font-medium text-ink">{c.name}</td>
                    <td className="py-2.5">{c.comp_group ? <Pill tone="neutral">{c.comp_group}</Pill> : <span className="text-faint">—</span>}</td>
                    <td className="py-2.5 text-muted">{scaleName(c.scale_id)}</td>
                    <td className="py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => edit(c)} className="inline-flex min-h-9 items-center rounded-xl px-2.5 text-sm font-medium text-brand transition hover:bg-brand-50">Edit</button>
                        <ConfirmButton onConfirm={() => del(c.id)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ListCard>
    </div>
  );
}

function DescriptorsEditor({ competencyId, scaleLevels }: { competencyId: string; scaleLevels: ProficiencyLevel[] }) {
  const { rows, loading, upsert } = useCrud<LevelDescriptor>(
    "competency_level_descriptor",
    "id, competency_id, level_id, indicator_text",
    { filters: { competency_id: competencyId } },
  );
  const [texts, setTexts] = useState<Record<string, string>>({});
  const hydrated = useRef(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Hydrate the textareas once from the loaded rows (the component is keyed by
  // competency id, so it remounts — and re-hydrates — whenever the competency changes).
  // `texts` isn't a dependency, so this isn't a render cascade.
  useEffect(() => {
    if (hydrated.current || loading) return;
    const map: Record<string, string> = {};
    for (const r of rows) map[r.level_id] = r.indicator_text ?? "";
    setTexts(map);
    hydrated.current = true;
  }, [loading, rows]);

  async function saveAll() {
    setBusy(true);
    setMsg(null);
    setError(null);
    let firstError: string | null = null;
    for (const l of scaleLevels) {
      const text = (texts[l.id] ?? "").trim();
      if (!text) continue;
      const res = await upsert({ competency_id: competencyId, level_id: l.id, indicator_text: text }, "competency_id,level_id");
      if (!res.ok) {
        firstError = res.error;
        break;
      }
    }
    if (firstError) setError(firstError);
    else setMsg("Indicators saved.");
    setBusy(false);
  }

  const missing = missingDescriptors(scaleLevels, rows);
  const setCount = scaleLevels.length - missing.length;

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">Level indicators</h3>
        <Pill tone={missing.length === 0 ? "success" : "warn"}>{setCount} of {scaleLevels.length} set</Pill>
      </div>
      <p className="mb-4 text-xs text-muted">Describe what someone can do at each level. These appear alongside the assessment.</p>
      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : scaleLevels.length === 0 ? (
        <p className="text-sm text-muted">This competency&rsquo;s scale has no levels yet — add them under Scales first.</p>
      ) : (
        <div className="space-y-3">
          {scaleLevels.map((l) => (
            <div key={l.id}>
              <label htmlFor={`desc-${l.id}`} className="mb-1 block text-sm font-medium text-ink">
                Rank {l.rank} · {l.label}
              </label>
              <textarea
                id={`desc-${l.id}`}
                rows={2}
                className={inputClass}
                value={texts[l.id] ?? ""}
                onChange={(e) => setTexts((t) => ({ ...t, [l.id]: e.target.value }))}
              />
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button type="button" onClick={saveAll} disabled={busy}>{busy ? "Saving…" : "Save indicators"}</Button>
            <EditorStatus msg={msg} error={error} />
          </div>
        </div>
      )}
    </Card>
  );
}
