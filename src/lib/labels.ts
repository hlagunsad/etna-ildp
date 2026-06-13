import type { GapStatus, Readiness } from "./types";

export const READINESS_LABEL: Record<Readiness, string> = {
  on_track: "On Track",
  at_risk: "At Risk",
  behind: "Behind",
};

export const READINESS_CLASS: Record<Readiness, string> = {
  on_track: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  at_risk: "bg-amber-100 text-amber-700 ring-amber-200",
  behind: "bg-red-100 text-red-700 ring-red-200",
};

export const GAP_LABEL: Record<GapStatus, string> = {
  open: "Open",
  improving: "Improving",
  stalled: "Stalled",
  regressed: "Regressed",
  closed: "Closed",
  new: "New",
  retargeted: "Re-targeted",
};

export const GAP_CLASS: Record<GapStatus, string> = {
  open: "bg-slate-100 text-slate-600",
  improving: "bg-sky-100 text-sky-700",
  stalled: "bg-amber-100 text-amber-700",
  regressed: "bg-red-100 text-red-700",
  closed: "bg-emerald-100 text-emerald-700",
  new: "bg-violet-100 text-violet-700",
  retargeted: "bg-indigo-100 text-indigo-700",
};

export const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  hr_admin: "HR / L&D Admin",
  supervisor: "Supervisor",
  employee: "Employee",
};
