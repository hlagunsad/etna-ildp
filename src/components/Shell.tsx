"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { can } from "@/lib/permissions";
import { ROLE_LABEL } from "@/lib/labels";
import type { Profile } from "@/lib/types";
import { Button } from "./ui";
import EmployeeDashboard from "./employee/EmployeeDashboard";
import TakeTna from "./employee/TakeTna";
import MyIldp from "./employee/MyIldp";
import MyTraining from "./employee/MyTraining";
import TeamPanel from "./TeamPanel";
import OrgPanel from "./OrgPanel";
import AdminPanel from "./AdminPanel";
import LibraryPanel from "./library/LibraryPanel";
import ReportsPanel from "./reports/ReportsPanel";

type Tab = { key: string; label: string; icon: ReactNode };

function Wordmark({ onClick }: { onClick?: () => void }) {
  return (
    <button onClick={onClick} className="group flex items-center gap-2.5 rounded-lg text-left">
      <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20V9" />
          <path d="M12 9c0-3 2.2-5 5-5 0 3-2.2 5-5 5Z" />
          <path d="M12 12C12 9.5 9.8 7.5 7 7.5c0 2.5 2.2 4.5 5 4.5Z" />
        </svg>
      </span>
      <span className="font-display text-lg font-semibold tracking-tight text-ink">
        eTNA <span className="text-brand">→</span> ILDP
      </span>
    </button>
  );
}

function RoleBadge({ role }: { role: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-chip px-3 py-1 text-xs font-semibold text-muted">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand" />
      {ROLE_LABEL[role ?? ""] ?? "—"}
    </span>
  );
}

// Minimal line icons (no dependency).
const ic = {
  dashboard: "M3 3h7v7H3zM14 3h7v4h-7zM14 11h7v10h-7zM3 14h7v7H3z",
  tna: "M9 3h6a2 2 0 0 1 2 2v0H7v0a2 2 0 0 1 2-2zM7 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1M9 13l2 2 4-4",
  ildp: "M12 2v4M12 18v4M2 12h4M18 12h4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  training: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5",
  team: "M16 19v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM22 19v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11",
  org: "M4 21V5a2 2 0 0 1 2-2h6v18M12 9h6a2 2 0 0 1 2 2v10M8 7h0M8 11h0M8 15h0M16 13h0M16 17h0",
  audit: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4",
  library: "M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  reports: "M3 3v18h18M7 16l4-5 3 3 5-7",
};

function NavIcon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      {d.split("M").filter(Boolean).map((seg, i) => (
        <path key={i} d={`M${seg}`} />
      ))}
    </svg>
  );
}

export default function Shell({ session, profile }: { session: Session; profile: Profile | null }) {
  const role = profile?.role ?? null;
  const userId = session.user.id;
  const [active, setActive] = useState("dashboard");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const tabs: Tab[] = [
    { key: "dashboard", label: "My Development", icon: <NavIcon d={ic.dashboard} /> },
    { key: "tna", label: "My TNA", icon: <NavIcon d={ic.tna} /> },
    { key: "ildp", label: "My ILDP", icon: <NavIcon d={ic.ildp} /> },
    { key: "training", label: "My Training", icon: <NavIcon d={ic.training} /> },
  ];
  if (can(role, "view_team")) tabs.push({ key: "team", label: "Team", icon: <NavIcon d={ic.team} /> });
  if (can(role, "view_org")) tabs.push({ key: "org", label: "Organization", icon: <NavIcon d={ic.org} /> });
  if (can(role, "view_team")) tabs.push({ key: "reports", label: "Reports", icon: <NavIcon d={ic.reports} /> });
  if (can(role, "manage_library")) tabs.push({ key: "library", label: "Library", icon: <NavIcon d={ic.library} /> });
  if (can(role, "view_audit")) tabs.push({ key: "audit", label: "Admin", icon: <NavIcon d={ic.audit} /> });

  // ESC closes the drawer; focus the drawer when it opens; restore focus on close.
  useEffect(() => {
    if (!drawerOpen) return;
    const toggle = toggleRef.current;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawerOpen(false); };
    document.addEventListener("keydown", onKey);
    drawerRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      toggle?.focus(); // restore focus to the menu toggle when the drawer closes
    };
  }, [drawerOpen]);

  function go(key: string) {
    setActive(key);
    setDrawerOpen(false);
  }

  // Keep keyboard focus inside the open drawer (focus trap for the modal dialog).
  function trapTab(e: React.KeyboardEvent) {
    if (e.key !== "Tab" || !drawerRef.current) return;
    const f = drawerRef.current.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (f.length === 0) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function renderNav(idPrefix: string) {
    return (
      <nav aria-label="Primary" className="flex flex-col gap-1">
        {tabs.map((t) => {
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              id={`${idPrefix}-${t.key}`}
              onClick={() => go(t.key)}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${
                isActive ? "bg-brand-50 text-brand" : "text-muted hover:bg-chip hover:text-ink"
              }`}
            >
              <span className={isActive ? "text-brand" : "text-faint"}>{t.icon}</span>
              {t.label}
            </button>
          );
        })}
      </nav>
    );
  }

  const activeLabel = tabs.find((t) => t.key === active)?.label ?? "";

  return (
    <div className="min-h-dvh lg:flex">
      <a href="#main" className="skip-link">Skip to content</a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface/70 backdrop-blur lg:flex">
        <div className="px-5 pb-3 pt-5"><Wordmark onClick={() => go("dashboard")} /></div>
        <div className="px-5 pb-4"><RoleBadge role={role} /></div>
        <div className="flex-1 overflow-y-auto px-3">
          {renderNav("desk-nav")}
        </div>
        <div className="border-t border-line p-4">
          <p className="truncate text-xs text-muted" title={profile?.email ?? ""}>{profile?.email}</p>
          <Button variant="secondary" size="sm" onClick={() => getSupabase().auth.signOut()} className="mt-2 w-full">
            Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/90 px-3 py-2.5 backdrop-blur lg:hidden">
        <button
          ref={toggleRef}
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={drawerOpen}
          aria-controls="mobile-drawer"
          className="grid h-11 w-11 place-items-center rounded-xl text-ink hover:bg-chip"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Wordmark onClick={() => go("dashboard")} />
        <Button variant="ghost" size="sm" onClick={() => getSupabase().auth.signOut()}>Sign out</Button>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden">
          <div className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[1px]" onClick={() => setDrawerOpen(false)} aria-hidden />
          <div
            id="mobile-drawer"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            tabIndex={-1}
            onKeyDown={trapTab}
            className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[86%] flex-col bg-surface p-4 shadow-2xl outline-none"
          >
            <div className="flex items-center justify-between">
              <Wordmark onClick={() => go("dashboard")} />
              <button onClick={() => setDrawerOpen(false)} aria-label="Close menu" className="grid h-10 w-10 place-items-center rounded-xl text-muted hover:bg-chip">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <div className="mt-3 mb-4"><RoleBadge role={role} /></div>
            {renderNav("mob-nav")}
            <p className="mt-auto truncate pt-4 text-xs text-muted">{profile?.email}</p>
          </div>
        </div>
      )}

      {/* Main */}
      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div key={active} className="rise mx-auto max-w-5xl">
          <p className="sr-only" aria-live="polite">{activeLabel}</p>
          {active === "dashboard" && <EmployeeDashboard userId={userId} self />}
          {active === "tna" && <TakeTna userId={userId} />}
          {active === "ildp" && <MyIldp userId={userId} selfId={userId} />}
          {active === "training" && <MyTraining userId={userId} />}
          {active === "team" && <TeamPanel selfId={userId} role={role} />}
          {active === "org" && <OrgPanel />}
          {active === "reports" && <ReportsPanel role={role} />}
          {active === "library" && <LibraryPanel />}
          {active === "audit" && <AdminPanel canUsers={can(role, "manage_users")} role={role} />}
        </div>
      </main>
    </div>
  );
}
