"use client";

import { useState } from "react";
import { useCrud } from "@/lib/useCrud";
import type { OrgUnit } from "@/lib/types";
import { Button, Field, inputClass } from "../ui";
import { ConfirmButton, EditorStatus, FormCard, ListCard } from "./EditorShell";

export default function OrgUnitEditor() {
  const { rows, loading, create, update, remove } = useCrud<OrgUnit>("org_unit", "id, name, description, parent_id", {
    orderBy: "name",
    unique: "An org unit with that name already exists.",
    fk: "Can't delete — it has child units or people assigned to it.",
  });
  const [form, setForm] = useState({ name: "", description: "", parent_id: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nameById = (id: string | null) => rows.find((r) => r.id === id)?.name ?? "—";

  function reset() {
    setEditingId(null);
    setForm({ name: "", description: "", parent_id: "" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setError(null);
    const payload = { name: form.name.trim(), description: form.description.trim() || null, parent_id: form.parent_id || null };
    const res = editingId ? await update(editingId, payload) : await create(payload);
    if (res.ok) {
      setMsg(editingId ? "Saved." : "Org unit added.");
      reset();
    } else {
      setError(res.error);
    }
    setBusy(false);
  }

  function edit(u: OrgUnit) {
    setEditingId(u.id);
    setForm({ name: u.name, description: u.description ?? "", parent_id: u.parent_id ?? "" });
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

  // A unit can't be its own parent (the DB FK + restrict guards deeper cycles).
  const parentOptions = rows.filter((r) => r.id !== editingId);

  return (
    <div className="space-y-6">
      <FormCard
        title={editingId ? "Edit org unit" : "Add org unit"}
        hint="Build the org tree — a unit can sit under a parent. People are assigned to units in Admin."
      >
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="ou-name">
            <input id="ou-name" required className={inputClass} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Parent unit" htmlFor="ou-parent" hint="Optional — leave blank for a top-level unit.">
            <select id="ou-parent" className={inputClass} value={form.parent_id} onChange={(e) => setForm((f) => ({ ...f, parent_id: e.target.value }))}>
              <option value="">— Top level —</option>
              {parentOptions.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description" htmlFor="ou-desc">
              <input id="ou-desc" className={inputClass} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={busy}>{busy ? "Saving…" : editingId ? "Save changes" : "Add org unit"}</Button>
            {editingId && (
              <Button type="button" variant="secondary" onClick={reset}>Cancel</Button>
            )}
            <EditorStatus msg={msg} error={error} />
          </div>
        </form>
      </FormCard>

      <ListCard title="Org units" count={rows.length}>
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted">No org units yet — add the first above.</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 first:pt-0 last:pb-0">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">{u.name}</span>
                  {u.parent_id && <span className="block truncate text-xs text-muted">under {nameById(u.parent_id)}</span>}
                </span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => edit(u)} className="inline-flex min-h-9 items-center rounded-xl px-2.5 text-sm font-medium text-brand transition hover:bg-brand-50">Edit</button>
                  <ConfirmButton onConfirm={() => del(u.id)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </ListCard>
    </div>
  );
}
