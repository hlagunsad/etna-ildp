"use client";

import { useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { can } from "@/lib/permissions";
import { ROLE_LABEL } from "@/lib/labels";
import type { Profile } from "@/lib/types";
import EmployeeDashboard from "./employee/EmployeeDashboard";
import TakeTna from "./employee/TakeTna";
import MyIldp from "./employee/MyIldp";
import MyTraining from "./employee/MyTraining";
import TeamPanel from "./TeamPanel";
import OrgPanel from "./OrgPanel";
import AdminPanel from "./AdminPanel";

type Tab = { key: string; label: string };

export default function Shell({ session, profile }: { session: Session; profile: Profile | null }) {
  const role = profile?.role ?? null;
  const userId = session.user.id;

  const tabs: Tab[] = [
    { key: "dashboard", label: "My Development" },
    { key: "tna", label: "My TNA" },
    { key: "ildp", label: "My ILDP" },
    { key: "training", label: "My Training" },
  ];
  // Management tabs (filled in by the management-UI build).
  if (can(role, "view_team")) tabs.push({ key: "team", label: "Team" });
  if (can(role, "view_org")) tabs.push({ key: "org", label: "Organization" });
  if (can(role, "view_audit")) tabs.push({ key: "audit", label: "Admin" });

  const [active, setActive] = useState("dashboard");

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="font-bold tracking-tight text-slate-900">eTNA → ILDP</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
              {ROLE_LABEL[role ?? ""] ?? "—"}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-500 sm:inline">{profile?.email}</span>
            <button
              onClick={() => getSupabase().auth.signOut()}
              className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${
                active === t.key
                  ? "border-sky-500 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {active === "dashboard" && <EmployeeDashboard userId={userId} self />}
        {active === "tna" && <TakeTna userId={userId} />}
        {active === "ildp" && <MyIldp userId={userId} selfId={userId} />}
        {active === "training" && <MyTraining userId={userId} />}
        {active === "team" && <TeamPanel selfId={userId} role={role} />}
        {active === "org" && <OrgPanel />}
        {active === "audit" && <AdminPanel canUsers={can(role, "manage_users")} role={role} />}
      </main>
    </div>
  );
}
