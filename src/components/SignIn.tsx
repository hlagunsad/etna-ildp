"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";

const DEMO = [
  ["super@demo.test", "lolom0panot000", "Super Admin"],
  ["hr@demo.test", "lolom0panot111", "HR / L&D Admin"],
  ["supervisor@demo.test", "lolom0panot222", "Supervisor"],
  ["employee@demo.test", "lolom0panot333", "Employee (has a baseline)"],
];

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setBusy(false);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">eTNA → ILDP</h1>
        <p className="mt-1 text-sm text-slate-500">
          Competency development platform — annual Training Needs Analysis, gap analysis, and a
          3-year Individual Learning &amp; Development Plan.
        </p>
      </div>

      <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm font-medium text-slate-700">Email</label>
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
        />
        <label className="mt-4 block text-sm font-medium text-slate-700">Password</label>
        <input
          type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
        />
        <button
          type="submit" disabled={busy}
          className="mt-5 w-full rounded-lg bg-slate-900 px-4 py-2.5 font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </form>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
        <p className="font-medium text-slate-600">Demo logins — click to fill</p>
        <div className="mt-1.5 space-y-1">
          {DEMO.map(([e, p, label]) => (
            <button
              key={e} type="button"
              onClick={() => { setEmail(e); setPassword(p); }}
              className="block w-full text-left hover:text-slate-900"
            >
              <span className="font-mono text-slate-700">{e}</span> — {label}
            </button>
          ))}
          <p className="pt-1 text-slate-400">(supervisor@ and employee2@ also exist · password pattern lolom0panotNNN)</p>
        </div>
      </div>
    </main>
  );
}
