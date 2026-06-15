"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { Button, Card, Field, inputClass } from "./ui";

// Shown when a user arrives via an invite or password-reset link (a recovery session).
// They set a password, which finishes activating the invited account.
export default function SetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("The passwords don't match.");
    setBusy(true);
    setError(null);
    const { error } = await getSupabase().auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    // Strip the invite/recovery token from the URL, then enter the app.
    if (typeof window !== "undefined") window.history.replaceState(null, "", window.location.pathname);
    onDone();
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
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Set your password</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">Choose a password to finish setting up your eTNA &rarr; ILDP account.</p>
      </div>

      <Card className="p-6">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="New password" htmlFor="np" hint="At least 8 characters">
            <input id="np" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Confirm password" htmlFor="cp">
            <input id="cp" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
          </Field>
          <Button type="submit" disabled={busy} className="w-full">{busy ? "Saving…" : "Set password & continue"}</Button>
          {error && <p role="alert" className="rounded-xl bg-danger-50 px-3 py-2 text-sm font-medium text-danger">{error}</p>}
        </form>
      </Card>
    </main>
  );
}
