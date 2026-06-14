"use client";

import { useCallback, useEffect, useState } from "react";
import { loadLibrary } from "@/lib/queries";
import { levelsForScale } from "@/lib/library";
import { useCrud } from "@/lib/useCrud";
import type { AssessmentItem, CompetencyRow, ProficiencyLevel } from "@/lib/types";
import { Button, Card, Field, Pill, inputClass } from "../ui";
import { ConfirmButton, EditorStatus, FormCard } from "./EditorShell";

export default function ItemEditor() {
  const [comps, setComps] = useState<CompetencyRow[]>([]);
  const [levels, setLevels] = useState<ProficiencyLevel[]>([]);
  const [selectedCompId, setSelectedCompId] = useState("");
  const [form, setForm] = useState({ prompt_text: "", level_id: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { rows: items, loading, create, update, remove } = useCrud<AssessmentItem>(
    "assessment_item",
    "id, competency_id, prompt_text, response_type, level_id",
    {
      filters: { competency_id: selectedCompId, response_type: "yes_no" },
      unique: "That item already exists.",
      fk: "Can't delete — someone has already answered this item in a TNA.",
    },
  );

  const loadSiblings = useCallback(async () => {
    const lib = await loadLibrary();
    setComps(lib.competencies);
    setLevels(lib.levels);
    // Default to the first competency, without making selection a render-cascading effect.
    setSelectedCompId((cur) => cur || lib.competencies[0]?.id || "");
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; setState runs after the awaited load, not a synchronous cascade
  useEffect(() => { loadSiblings(); }, [loadSiblings]);

  const selectedComp = comps.find((c) => c.id === selectedCompId) ?? null;
  const scaleLevels = selectedComp ? levelsForScale(selectedComp.scale_id, levels) : [];
  const orphans = items.filter((it) => !scaleLevels.some((l) => l.id === it.level_id));

  function resetForm() {
    setEditingId(null);
    setForm({ prompt_text: "", level_id: "" });
  }

  function changeComp(id: string) {
    setSelectedCompId(id);
    resetForm();
    setMsg(null);
    setError(null);
  }

  function edit(it: AssessmentItem) {
    setEditingId(it.id);
    setForm({ prompt_text: it.prompt_text ?? "", level_id: it.level_id ?? "" });
    setMsg(null);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setError(null);
    const prompt_text = form.prompt_text.trim();
    const level_id = form.level_id || null;
    const res = editingId
      ? await update(editingId, { prompt_text, level_id })
      : await create({ competency_id: selectedCompId, response_type: "yes_no", prompt_text, level_id });
    if (res.ok) {
      setMsg(editingId ? "Saved." : "Item added.");
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

  function renderItem(it: AssessmentItem) {
    return (
      <li key={it.id} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
        <span className="min-w-0 flex-1 text-sm text-ink">{it.prompt_text}</span>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => edit(it)} className="inline-flex min-h-9 items-center rounded-xl px-2.5 text-sm font-medium text-brand transition hover:bg-brand-50">Edit</button>
          <ConfirmButton onConfirm={() => del(it.id)} />
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-6">
        <Field label="Competency" htmlFor="it-comp" hint="Items are the “Can I…?” statements an employee checks during their TNA. They roll up to an assessed level.">
          <select id="it-comp" className={inputClass} value={selectedCompId} onChange={(e) => changeComp(e.target.value)}>
            {comps.length === 0 && <option value="">— No competencies yet —</option>}
            {comps.map((c) => (
              <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
            ))}
          </select>
        </Field>
      </Card>

      {selectedComp && (
        <FormCard
          title={editingId ? "Edit item" : "Add item"}
          hint="Phrase it as something the employee can self-assess, e.g. “Can I configure a firewall rule?”."
        >
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <Field label="Statement" htmlFor="it-prompt">
              <textarea id="it-prompt" rows={2} required className={inputClass} value={form.prompt_text} onChange={(e) => setForm((f) => ({ ...f, prompt_text: e.target.value }))} />
            </Field>
            <Field label="Level" htmlFor="it-level">
              <select id="it-level" required className={inputClass} value={form.level_id} onChange={(e) => setForm((f) => ({ ...f, level_id: e.target.value }))}>
                <option value="">— Level —</option>
                {scaleLevels.map((l) => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </select>
            </Field>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <Button type="submit" disabled={busy}>{busy ? "Saving…" : editingId ? "Save changes" : "Add item"}</Button>
              {editingId && (
                <Button type="button" variant="secondary" onClick={resetForm}>Cancel</Button>
              )}
              <EditorStatus msg={msg} error={error} />
            </div>
          </form>
        </FormCard>
      )}

      {selectedComp && (
        <Card className="p-5 sm:p-6">
          <h3 className="mb-3 text-sm font-semibold text-muted">Items by level{loading ? "" : ` (${items.length})`}</h3>
          {loading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : scaleLevels.length === 0 ? (
            <p className="text-sm text-muted">This competency&rsquo;s scale has no levels yet — add them under Scales first.</p>
          ) : (
            <div className="space-y-5">
              {scaleLevels.map((l) => {
                const list = items.filter((it) => it.level_id === l.id);
                return (
                  <div key={l.id}>
                    <div className="mb-1 flex items-center justify-between gap-2 border-b border-line pb-1">
                      <h4 className="text-sm font-semibold text-ink">Rank {l.rank} · {l.label}</h4>
                      <Pill tone={list.length < 3 ? "warn" : "success"}>{list.length} item{list.length === 1 ? "" : "s"}</Pill>
                    </div>
                    {list.length === 0 ? (
                      <p className="py-1.5 text-sm text-muted">No items yet — aim for at least 3 so the roll-up is reliable.</p>
                    ) : (
                      <ul className="divide-y divide-line">
                        {list.map((it) => renderItem(it))}
                      </ul>
                    )}
                  </div>
                );
              })}

              {orphans.length > 0 && (
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2 border-b border-line pb-1">
                    <h4 className="text-sm font-semibold text-amber">Unassigned level</h4>
                    <Pill tone="warn">{orphans.length}</Pill>
                  </div>
                  <ul className="divide-y divide-line">
                    {orphans.map((it) => renderItem(it))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
