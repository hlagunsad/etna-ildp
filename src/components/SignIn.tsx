"use client";

import { useState } from "react";
import type { Provider } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { Button, Card, Field, inputClass } from "./ui";

// SSO is off until providers are listed in NEXT_PUBLIC_SSO_PROVIDERS (e.g. "google,azure").
const SSO_PROVIDERS = (process.env.NEXT_PUBLIC_SSO_PROVIDERS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const ssoLabel = (p: string) => (p === "azure" ? "Microsoft" : p.charAt(0).toUpperCase() + p.slice(1));

const DEMO = [
  ["super@demo.test", "lolom0panot000", "Super Admin"],
  ["hr@demo.test", "lolom0panot111", "HR / L&D Admin"],
  ["supervisor@demo.test", "lolom0panot222", "Supervisor"],
  ["employee@demo.test", "lolom0panot333", "Employee · has a baseline"],
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

  async function ssoSignIn(provider: string) {
    setError(null);
    const { error } = await getSupabase().auth.signInWithOAuth({
      provider: provider as Provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-7">
        <span aria-hidden className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-brand text-white">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20V9" />
            <path d="M12 9c0-3 2.2-5 5-5 0 3-2.2 5-5 5Z" />
            <path d="M12 12C12 9.5 9.8 7.5 7 7.5c0 2.5 2.2 4.5 5 4.5Z" />
          </svg>
        </span>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
          eTNA <span className="text-brand">→</span> ILDP
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          A competency development platform — annual Training Needs Analysis, gap analysis, and a
          3-year Individual Learning &amp; Development Plan.
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Email" htmlFor="email">
            <input id="email" type="email" autoComplete="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Password" htmlFor="password">
            <input id="password" type="password" autoComplete="current-password" required value={password}
              onChange={(e) => setPassword(e.target.value)} className={inputClass} />
          </Field>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Signing in…" : "Sign in"}
          </Button>
          {error && (
            <p role="alert" className="rounded-xl bg-danger-50 px-3 py-2 text-sm font-medium text-danger">{error}</p>
          )}
        </form>

        {SSO_PROVIDERS.length > 0 && (
          <div className="mt-5 space-y-2 border-t border-line pt-5">
            <p className="text-xs font-medium text-muted">Or use single sign-on</p>
            {SSO_PROVIDERS.map((p) => (
              <Button key={p} type="button" variant="secondary" className="w-full" onClick={() => ssoSignIn(p)}>
                Continue with {ssoLabel(p)}
              </Button>
            ))}
          </div>
        )}
      </Card>

      <div className="mt-4 rounded-2xl border border-line bg-chip/60 p-4">
        <p className="text-xs font-semibold text-muted">Demo logins — tap to fill</p>
        <ul className="mt-2 space-y-1">
          {DEMO.map(([e, p, label]) => (
            <li key={e}>
              <button
                type="button"
                onClick={() => { setEmail(e); setPassword(p); }}
                className="flex min-h-9 w-full items-center justify-between gap-2 rounded-lg px-2 text-left text-xs hover:bg-surface"
              >
                <span className="font-mono text-ink">{e}</span>
                <span className="text-faint">{label}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-1.5 px-2 text-[11px] text-faint">supervisor@ and employee2@ also exist · password lolom0panot + 222 / 444</p>
      </div>
    </main>
  );
}
