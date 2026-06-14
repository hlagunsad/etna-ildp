"use client";

import { useState } from "react";
import { useCrud } from "@/lib/useCrud";
import type { ProficiencyLevel, Scale } from "@/lib/types";
import { Button, Card, Field, Pill, inputClass } from "../ui";
import { ConfirmButton, EditorStatus, FormCard, ListCard } from "./EditorShell";

export default function ScaleEditor() {
  const { rows: scales, loading, create, update, remove } = useCrud<Scale>("proficiency_scale", "id, name", {
    orderBy: "name",
    unique: "A scale with that name already exists.",
    fk: "Can't delete — a competency still uses this scale.",
  });
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setEditingId(null);
    setName("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setError(null);
    const res = editingId ? await update(editingId, { name: name.trim() }) : await create({ name: name.trim() });
    if (res.ok) {
      setMsg(editingId ? "Saved." : "Scale added.");
      resetForm();
    } else {
      setError(res.error);
    }
    setBusy(false);
  }

  function edit(s: Scale) {
    setEditingId(s.id);
    setName(s.name);
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

  const selected = scales.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <FormCard
        title={editingId ? "Edit scale" : "Add proficiency scale"}
        hint="A scale is a set of ordered levels (e.g. Basic → Intermediate → Advanced) that competencies are measured against."
      >
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[16rem] flex-1">
            <Field label="Scale name" htmlFor="sc-name">
              <input id="sc-name" required className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
          </div>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : editingId ? "Save changes" : "Add scale"}</Button>
          {editingId && (
            <Button type="button" variant="secondary" onClick={resetForm}>Cancel</Button>
          )}
          <EditorStatus msg={msg} error={error} />
        </form>
      </FormCard>

      <ListCard title="Scales" count={scales.length}>
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : scales.length === 0 ? (
          <p className="text-sm text-muted">No scales yet — add the first above.</p>
        ) : (
          <ul className="divide-y divide-line">
            {scales.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 first:pt-0 last:pb-0">
                <span className="min-w-0 flex-1 truncate font-medium text-ink">{s.name}</span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant={selectedId === s.id ? "primary" : "secondary"}
                    size="sm"
                    aria-expanded={selectedId === s.id}
                    onClick={() => setSelectedId(selectedId === s.id ? null : s.id)}
                  >
                    {selectedId === s.id ? "Hide levels" : "Levels"}
                  </Button>
                  <button type="button" onClick={() => edit(s)} className="inline-flex min-h-9 items-center rounded-xl px-2.5 text-sm font-medium text-brand transition hover:bg-brand-50">Edit</button>
                  <ConfirmButton onConfirm={() => del(s.id)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </ListCard>

      {selected && <LevelsEditor key={selected.id} scaleId={selected.id} scaleName={selected.name} />}
    </div>
  );
}

function LevelsEditor({ scaleId, scaleName }: { scaleId: string; scaleName: string }) {
  const { rows: levels, loading, create, update, remove } = useCrud<ProficiencyLevel>(
    "proficiency_level",
    "id, scale_id, rank, label",
    {
      filters: { scale_id: scaleId },
      orderBy: "rank",
      unique: "That rank already exists in this scale.",
      fk: "Can't delete — this level is used as a target or has been assessed.",
    },
  );
  const [form, setForm] = useState({ rank: "", label: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setEditingId(null);
    setForm({ rank: "", label: "" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setError(null);
    const rank = Number(form.rank);
    const label = form.label.trim();
    const res = editingId ? await update(editingId, { rank, label }) : await create({ scale_id: scaleId, rank, label });
    if (res.ok) {
      setMsg(editingId ? "Saved." : "Level added.");
      reset();
    } else {
      setError(res.error);
    }
    setBusy(false);
  }

  function edit(l: ProficiencyLevel) {
    setEditingId(l.id);
    setForm({ rank: String(l.rank), label: l.label });
    setMsg(null);
    setError(null);
  }

  async function del(id: string) {
    setMsg(null);
    setError(null);
    const res = await remove(id);
    if (res.ok) {
      setMsg("Deleted.");
      if (editingId === id) reset();
    } else {
      setError(res.error);
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <h3 className="text-sm font-semibold text-ink">Levels for “{scaleName}”</h3>
      <p className="mb-4 mt-1 text-xs text-muted">Rank orders the levels from lowest (1) upward.</p>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <div className="w-24">
          <Field label="Rank" htmlFor="lv-rank">
            <input id="lv-rank" type="number" min="1" required className={inputClass} value={form.rank} onChange={(e) => setForm((f) => ({ ...f, rank: e.target.value }))} />
          </Field>
        </div>
        <div className="min-w-[12rem] flex-1">
          <Field label="Label" htmlFor="lv-label">
            <input id="lv-label" required className={inputClass} value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
          </Field>
        </div>
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : editingId ? "Save" : "Add level"}</Button>
        {editingId && (
          <Button type="button" variant="secondary" onClick={reset}>Cancel</Button>
        )}
        <EditorStatus msg={msg} error={error} />
      </form>
      <div className="mt-4">
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : levels.length === 0 ? (
          <p className="text-sm text-muted">No levels yet — add Rank 1 first.</p>
        ) : (
          <ul className="divide-y divide-line">
            {levels.map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                <Pill tone="neutral">Rank {l.rank}</Pill>
                <span className="min-w-0 flex-1 truncate text-ink">{l.label}</span>
                <button type="button" onClick={() => edit(l)} className="inline-flex min-h-9 items-center rounded-xl px-2.5 text-sm font-medium text-brand transition hover:bg-brand-50">Edit</button>
                <ConfirmButton onConfirm={() => del(l.id)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
