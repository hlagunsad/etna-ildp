"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";
import SignIn from "./SignIn";
import Shell from "./Shell";
import { PermissionsProvider } from "./PermissionsProvider";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) return; // no session → <SignIn/> renders; profile is unused
    let active = true;
    getSupabase()
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => {
        if (active) setProfile((data as Profile) ?? null);
      });
    return () => {
      active = false;
    };
  }, [session]);

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-sm text-slate-400">Loading…</div>;
  }
  if (!session) return <SignIn />;
  return (
    <PermissionsProvider>
      <Shell session={session} profile={profile} />
    </PermissionsProvider>
  );
}
