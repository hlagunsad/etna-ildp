"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { apiPost } from "@/lib/api";
import { ROLE_LABEL } from "@/lib/labels";
import type { Profile, Role } from "@/lib/types";

type Audit = { id: string; actor_email: string | null; action: string; entity_type: string; created_at: string };
type JobRole = { id: string; name: string };

const EMPTY_FORM = {
  full_name: "",
  email: "",
  password: "",
  role: "employee",
  department: "",
  job_role_id: "",
  manager_id: "",
};

export default function AdminPanel({ canUsers, role }: { canUsers: boolean; role: Role | null }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = getSupabase();
    const [{ data: ps }, { data: a }, { data: jr }] = await Promise.all([
      sb.from("profiles").select("id, full_name, email, role, manager_id, job_role_id, department, status"),
      sb.from("audit_log").select("id, actor_email, action, entity_type, created_at").order("created_at", { ascending: false }).limit(50),
      sb.from("job_role").select("id, name"),
    ]);
    setProfiles((ps ?? []) as Profile[]);
    setAudit((a ?? []) as Audit[]);
    setJobRoles((jr ?? []) as JobRole[]);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; setState runs after the awaited load, not a synchronous cascade
  useEffect(() => { load(); }, [load]);

  const roleOptions: [string, string][] =
    role === "super_admin"
      ? [["employee", "Employee"], ["supervisor", "Supervisor"], ["hr_admin", "HR / L&D Admin"], ["super_admin", "Super Admin"]]
      : [["employee", "Employee"], ["supervisor", "Supervisor"]];

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await apiPost("/api/users/create", form);
      setMsg(`Created ${form.email} — they can sign in now with the temporary password.`);
      setForm({ ...EMPTY_FORM });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the account");
    }
    setBusy(false);
  }

  const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100";

  return (
    <div className="space-y-6">
      {canUsers && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="mb-1 text-sm font-semibold text-slate-700">Create user account</h3>
          <p className="mb-4 text-xs text-slate-400">
            No public sign-up — accounts are created here (HR cannot create admins). In production this sends an
            invitation email; here, share the temporary password directly.
          </p>
          <form onSubmit={createUser} className="grid gap-3 sm:grid-cols-2">
            <input className={inputCls} placeholder="Full name" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
            <input className={inputCls} type="email" required placeholder="Email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            <input className={inputCls} required placeholder="Temporary password (min 8)" value={form.password} onChange={(e) => set("password", e.target.value)} />
            <select className={inputCls} value={form.role} onChange={(e) => set("role", e.target.value)} aria-label="Role">
              {roleOptions.map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
            </select>
            <input className={inputCls} placeholder="Department" value={form.department} onChange={(e) => set("department", e.target.value)} />
            <select className={inputCls} value={form.job_role_id} onChange={(e) => set("job_role_id", e.target.value)} aria-label="Job role">
              <option value="">— Job role —</option>
              {jobRoles.map((jr) => (<option key={jr.id} value={jr.id}>{jr.name}</option>))}
            </select>
            <select className={inputCls} value={form.manager_id} onChange={(e) => set("manager_id", e.target.value)} aria-label="Manager">
              <option value="">— Manager —</option>
              {profiles.map((p) => (<option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>))}
            </select>
            <div className="flex items-center gap-3 sm:col-span-2">
              <button type="submit" disabled={busy} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60">
                {busy ? "Creating…" : "Create account"}
              </button>
              {msg && <span className="text-sm text-emerald-600">{msg}</span>}
              {error && <span className="text-sm text-red-600">{error}</span>}
            </div>
          </form>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">User accounts ({profiles.length})</h3>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-slate-400"><th className="pb-2">Name</th><th className="pb-2">Email</th><th className="pb-2">Role</th><th className="pb-2">Dept</th></tr></thead>
          <tbody>{profiles.map((p) => (
            <tr key={p.id} className="border-t border-slate-100">
              <td className="py-2 font-medium text-slate-800">{p.full_name ?? "—"}</td>
              <td className="py-2 text-slate-600">{p.email}</td>
              <td className="py-2"><span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{ROLE_LABEL[p.role]}</span></td>
              <td className="py-2 text-slate-600">{p.department}</td>
            </tr>
          ))}</tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Audit log (immutable)</h3>
        {audit.length === 0 ? (
          <p className="text-sm text-slate-400">No audit entries yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-slate-400"><th className="pb-2">When</th><th className="pb-2">Actor</th><th className="pb-2">Action</th><th className="pb-2">Entity</th></tr></thead>
            <tbody>{audit.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="py-2 text-slate-500">{new Date(a.created_at).toLocaleString()}</td>
                <td className="py-2 text-slate-600">{a.actor_email}</td>
                <td className="py-2"><span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{a.action}</span></td>
                <td className="py-2 text-slate-600">{a.entity_type}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>
    </div>
  );
}
