"use client";

import { useCallback, useEffect, useState } from "react";
import { loadLibrary } from "@/lib/queries";
import { levelsForScale } from "@/lib/library";
import { useCrud } from "@/lib/useCrud";
import { MODES, PROVIDERS, type CompetencyRow, type ProficiencyLevel, type TrainingResource } from "@/lib/types";
import { Button, Field, Pill, inputClass } from "../ui";
import { ConfirmButton, EditorStatus, FormCard, ListCard } from "./EditorShell";

const EMPTY = { title: "", provider: "", url: "", competency_id: "", target_level_id: "", mode: "", cost: "" };
const SELECT = "id, title, provider, url, competency_id, target_level_id, mode, cost";

export default function TrainingEditor() {
  const { rows, loading, create, update, remove } = useCrud<TrainingResource>("training_resource", SELECT, {
    orderBy: "title",
    unique: "A training resource with that title already exists.",
    fk: "Can't delete — this training is referenced by a learner's record.",
  });
  const [comps, setComps] = useState<CompetencyRow[]>([]);
  const [levels, setLevels] = useState<ProficiencyLevel[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [editingId, setEditingId] = useState<string | null>(null);
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

  const compById = (id: string | null) => comps.find((c) => c.id === id) ?? null;
  const levelById = (id: string | null) => levels.find((l) => l.id === id) ?? null;
  const selectedComp = compById(form.competency_id || null);
  const levelOptions = selectedComp ? levelsForScale(selectedComp.scale_id, levels) : levels;

  function edit(t: TrainingResource) {
    setEditingId(t.id);
    setForm({
      title: t.title ?? "",
      provider: t.provider ?? "",
      url: t.url ?? "",
      competency_id: t.competency_id ?? "",
      target_level_id: t.target_level_id ?? "",
      mode: t.mode ?? "",
      cost: t.cost != null ? String(t.cost) : "",
    });
    setMsg(null);
    setError(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setError(null);
    const payload = {
      title: form.title.trim(),
      provider: form.provider || null,
      url: form.url.trim() || null,
      competency_id: form.competency_id || null,
      target_level_id: form.target_level_id || null,
      mode: form.mode || null,
      cost: form.cost === "" ? 0 : Number(form.cost),
    };
    const res = editingId ? await update(editingId, payload) : await create(payload);
    if (res.ok) {
      setMsg(editingId ? "Saved." : `Added “${payload.title}”.`);
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

  return (
    <div className="space-y-6">
      <FormCard
        title={editingId ? "Edit training resource" : "Add training resource"}
        hint="The catalog supervisors and employees draw from when building a plan. Competency and level are optional."
      >
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Title" htmlFor="tr-title">
              <input id="tr-title" required className={inputClass} value={form.title} onChange={(e) => set("title", e.target.value)} />
            </Field>
          </div>
          <Field label="Provider" htmlFor="tr-provider">
            <select id="tr-provider" className={inputClass} value={form.provider} onChange={(e) => set("provider", e.target.value)}>
              <option value="">— Provider —</option>
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field label="Delivery mode" htmlFor="tr-mode">
            <select id="tr-mode" className={inputClass} value={form.mode} onChange={(e) => set("mode", e.target.value)}>
              <option value="">— Mode —</option>
              {MODES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Link (URL)" htmlFor="tr-url">
              <input id="tr-url" type="url" inputMode="url" className={inputClass} value={form.url} onChange={(e) => set("url", e.target.value)} />
            </Field>
          </div>
          <Field label="Competency" htmlFor="tr-comp" hint="Optional — what this training builds.">
            <select
              id="tr-comp"
              className={inputClass}
              value={form.competency_id}
              onChange={(e) => setForm((f) => ({ ...f, competency_id: e.target.value, target_level_id: "" }))}
            >
              <option value="">— Any / none —</option>
              {comps.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Target level" htmlFor="tr-level" hint="Optional — the level it helps reach.">
            <select id="tr-level" className={inputClass} value={form.target_level_id} onChange={(e) => set("target_level_id", e.target.value)}>
              <option value="">— Level —</option>
              {levelOptions.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Cost (₱)" htmlFor="tr-cost" hint="0 for free resources.">
            <input id="tr-cost" type="number" min="0" step="0.01" className={inputClass} value={form.cost} onChange={(e) => set("cost", e.target.value)} />
          </Field>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : editingId ? "Save changes" : "Add training"}</Button>
            {editingId && (
              <Button type="button" variant="secondary" onClick={resetForm}>Cancel</Button>
            )}
            <EditorStatus msg={msg} error={error} />
          </div>
        </form>
      </FormCard>

      <ListCard title="Training catalog" count={rows.length}>
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted">No training resources yet — add the first above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-faint">
                  <th scope="col" className="pb-2 font-medium">Title</th>
                  <th scope="col" className="pb-2 font-medium">Provider</th>
                  <th scope="col" className="pb-2 font-medium">Competency</th>
                  <th scope="col" className="pb-2 font-medium">Level</th>
                  <th scope="col" className="pb-2 font-medium">Cost</th>
                  <th scope="col" className="pb-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="border-t border-line">
                    <td className="py-2.5 font-medium text-ink">
                      {t.url ? (
                        <a href={t.url} target="_blank" rel="noreferrer" className="text-brand hover:underline">{t.title}</a>
                      ) : (
                        t.title
                      )}
                    </td>
                    <td className="py-2.5">{t.provider ? <Pill tone="neutral">{t.provider}</Pill> : <span className="text-faint">—</span>}</td>
                    <td className="py-2.5 text-muted">{compById(t.competency_id)?.name ?? "—"}</td>
                    <td className="py-2.5 text-muted">{levelById(t.target_level_id)?.label ?? "—"}</td>
                    <td className="py-2.5 tabular-nums text-muted">{t.cost ? `₱${t.cost}` : "Free"}</td>
                    <td className="py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => edit(t)} className="inline-flex min-h-9 items-center rounded-xl px-2.5 text-sm font-medium text-brand transition hover:bg-brand-50">Edit</button>
                        <ConfirmButton onConfirm={() => del(t.id)} />
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
