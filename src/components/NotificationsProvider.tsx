"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getSupabase } from "@/lib/supabase";

export type Notif = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

type Ctx = {
  items: Notif[];
  unread: number;
  reload: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationsContext = createContext<Ctx>({
  items: [],
  unread: 0,
  reload: async () => {},
  markRead: async () => {},
  markAllRead: async () => {},
});

// App-level feed. The SELECT is unfiltered — RLS scopes it to the caller's own rows
// (recipient_id = auth.uid()). Before migration 0005 the table is absent → [] (empty bell).
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Notif[]>([]);

  const reload = useCallback(async () => {
    const { data } = await getSupabase()
      .from("notification")
      .select("id, title, body, link, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data ?? []) as Notif[]);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; setState runs after the awaited load, not a synchronous cascade
  useEffect(() => { reload(); }, [reload]);

  const markRead = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.id === id && !n.read_at ? { ...n, read_at: now } : n))); // optimistic
    await getSupabase().from("notification").update({ read_at: now }).eq("id", id).is("read_at", null);
  }, []);

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    await getSupabase().from("notification").update({ read_at: now }).is("read_at", null); // RLS scopes to own
  }, []);

  const unread = items.reduce((n, x) => n + (x.read_at ? 0 : 1), 0);

  return (
    <NotificationsContext.Provider value={{ items, unread, reload, markRead, markAllRead }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
