"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { writeAudit } from "@/lib/useCrud";
import { CAPABILITIES, CAPABILITY_LABEL, type Capability } from "@/lib/permissions";
import { ROLE_LABEL } from "@/lib/labels";
import { usePermReload } from "./PermissionsProvider";
import { Card, Pill } from "./ui";
import { EditorStatus } from "./library/EditorShell";

const EDITABLE_ROLES = ["hr_admin", "supervisor", "employee"] as const;

export default function PermissionsMatrix() {
  const reloadPerms = usePermReload();
  const [granted, setGranted] = useState<Set<string>>(new Set()); // `${role}:${capability}`
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await getSupabase().from("role_permission").select("role, capability");
    setGranted(new Set(((data ?? []) as { role: string; capability: string }[]).map((r) => `${r.role}:${r.capability}`)));
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; setState runs after the awaited load, not a synchronous cascade
  useEffect(() => { load(); }, [load]);

  async function toggle(role: string, cap: Capability, on: boolean) {
    const key = `${role}:${cap}`;
    // Optimistic: flip the cell immediately, then persist (revert on error).
    setGranted((g) => {
      const next = new Set(g);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
    setBusyKey(key);
    setMsg(null);
    setError(null);
    const sb = getSupabase();
    const { error: e } = on
      ? await sb.from("role_permission").insert({ role, capability: cap } as never)
      : await sb.from("role_permission").delete().eq("role", role).eq("capability", cap);
    if (e) {
      setError(e.message);
      await load(); // revert the optimistic change to the true DB state
    } else {
      await writeAudit("update", "role_permission", null, { role, capability: cap, granted: !on }, { role, capability: cap, granted: on });
      setMsg(`${on ? "Granted" : "Revoked"} “${CAPABILITY_LABEL[cap]}” for ${ROLE_LABEL[role]}.`);
      await reloadPerms(); // re-gate the app live
    }
    setBusyKey(null);
  }

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-sm font-semibold text-ink">Role permissions</h2>
      <p className="mb-4 mt-1 text-xs text-muted">
        Tune what each role can do — changes apply across the app immediately. Super Admin always has full access and can&rsquo;t be locked out.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-faint">
              <th scope="col" className="pb-2 font-medium">Capability</th>
              {EDITABLE_ROLES.map((r) => (
                <th key={r} scope="col" className="pb-2 text-center font-medium">{ROLE_LABEL[r]}</th>
              ))}
              <th scope="col" className="pb-2 text-center font-medium">{ROLE_LABEL.super_admin}</th>
            </tr>
          </thead>
          <tbody>
            {CAPABILITIES.map((cap) => (
              <tr key={cap} className="border-t border-line">
                <td className="py-2.5 text-ink">{CAPABILITY_LABEL[cap]}</td>
                {EDITABLE_ROLES.map((r) => {
                  const key = `${r}:${cap}`;
                  return (
                    <td key={r} className="py-2.5 text-center">
                      <input
                        type="checkbox"
                        aria-label={`${CAPABILITY_LABEL[cap]} for ${ROLE_LABEL[r]}`}
                        className="h-4 w-4 accent-brand"
                        checked={granted.has(key)}
                        disabled={busyKey === key}
                        onChange={(e) => toggle(r, cap, e.target.checked)}
                      />
                    </td>
                  );
                })}
                <td className="py-2.5 text-center"><Pill tone="brand">always</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3"><EditorStatus msg={msg} error={error} /></div>
    </Card>
  );
}
