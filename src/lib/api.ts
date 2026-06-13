import { getSupabase } from "./supabase";

/** POST to one of the secret-key engine routes, attaching the caller's access token. */
export async function apiPost(path: string, body: unknown = {}): Promise<Record<string, unknown>> {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : "" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error((json.error as string) ?? "Request failed");
  return json;
}
