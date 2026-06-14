"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { apiPost } from "@/lib/api";
import { ROLE_LABEL } from "@/lib/labels";
import { Button, Card, Field, PageHeader, Pill, inputClass } from "./ui";
import type { Profile, Role } from "@/lib/types";

type Audit = { id: string; actor_email: string | null; action: string; entity_type: string; created_at: string };
type JobRole = { id: string; name: string };

const EMPTY_FORM = { full_name: "", email: "", password: "", role: "employee", department: "", job_role_id: "", manager_id: "" };

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
    setBusy(true); setError(null); setMsg(null);
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

  return (
    <>
      <PageHeader title="Administration" subtitle="User accounts and the immutable audit log." />

      <div className="space-y-6">
        {canUsers && (
          <Card className="p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-ink">Create user account</h2>
            <p className="mb-5 mt-1 text-xs text-muted">
              No public sign-up — accounts are created here (HR cannot create admins). In production this sends an
              invitation email; here, share the temporary password directly.
            </p>
            <form onSubmit={createUser} className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" htmlFor="cu-name"><input id="cu-name" className={inputClass} value={form.full_name} onChange={(e) => set("full_name", e.target.value)} /></Field>
              <Field label="Email" htmlFor="cu-email"><input id="cu-email" type="email" autoComplete="off" required className={inputClass} value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
              <Field label="Temporary password" htmlFor="cu-pw" hint="Minimum 8 characters"><input id="cu-pw" required className={inputClass} value={form.password} onChange={(e) => set("password", e.target.value)} /></Field>
              <Field label="Role" htmlFor="cu-role"><select id="cu-role" className={inputClass} value={form.role} onChange={(e) => set("role", e.target.value)}>{roleOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
              <Field label="Department" htmlFor="cu-dept"><input id="cu-dept" className={inputClass} value={form.department} onChange={(e) => set("department", e.target.value)} /></Field>
              <Field label="Job role" htmlFor="cu-jr"><select id="cu-jr" className={inputClass} value={form.job_role_id} onChange={(e) => set("job_role_id", e.target.value)}><option value="">— Job role —</option>{jobRoles.map((jr) => <option key={jr.id} value={jr.id}>{jr.name}</option>)}</select></Field>
              <Field label="Manager" htmlFor="cu-mgr"><select id="cu-mgr" className={inputClass} value={form.manager_id} onChange={(e) => set("manager_id", e.target.value)}><option value="">— Manager —</option>{profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>)}</select></Field>
              <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create account"}</Button>
                {msg && <span role="status" className="text-sm font-medium text-success">{msg}</span>}
                {error && <span role="alert" className="text-sm text-danger">{error}</span>}
              </div>
            </form>
          </Card>
        )}

        <Card className="p-5 sm:p-6">
          <h2 className="mb-3 text-sm font-semibold text-muted">User accounts ({profiles.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-faint">
                  <th scope="col" className="pb-2 font-medium">Name</th>
                  <th scope="col" className="pb-2 font-medium">Email</th>
                  <th scope="col" className="pb-2 font-medium">Role</th>
                  <th scope="col" className="pb-2 font-medium">Dept</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="py-2.5 font-medium text-ink">{p.full_name ?? "—"}</td>
                    <td className="py-2.5 text-muted">{p.email}</td>
                    <td className="py-2.5"><Pill tone="neutral">{ROLE_LABEL[p.role]}</Pill></td>
                    <td className="py-2.5 text-muted">{p.department}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="mb-3 text-sm font-semibold text-muted">Audit log (immutable)</h2>
          {audit.length === 0 ? (
            <p className="text-sm text-muted">No audit entries yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-faint">
                    <th scope="col" className="pb-2 font-medium">When</th>
                    <th scope="col" className="pb-2 font-medium">Actor</th>
                    <th scope="col" className="pb-2 font-medium">Action</th>
                    <th scope="col" className="pb-2 font-medium">Entity</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((a) => (
                    <tr key={a.id} className="border-t border-line">
                      <td className="py-2.5 text-muted">{new Date(a.created_at).toLocaleString()}</td>
                      <td className="py-2.5 text-muted">{a.actor_email}</td>
                      <td className="py-2.5"><Pill tone="neutral">{a.action}</Pill></td>
                      <td className="py-2.5 text-muted">{a.entity_type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
