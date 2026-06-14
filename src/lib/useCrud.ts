import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "./supabase";
import { friendlyDbError, type DbErr } from "./library";

/**
 * A small client-side CRUD hook for the HR/Super-Admin content-library editors.
 *
 * The reference tables grant admins full read/write via RLS
 * (`<t>_admin for all using(is_admin())`), so these writes go straight from the
 * browser — no server route. Every successful write also appends an audit_log
 * row (the `audit self insert` RLS policy allows `actor_id = auth.uid()`).
 * Postgres has no DELETE audit action, so deletes are recorded as an `update`
 * with `after: null` (an append-only convention; no migration needed).
 *
 * Each mutation returns { ok, error } instead of throwing, so the calling editor
 * controls its own messaging.
 */

export type CrudResult = { ok: boolean; error: string | null };

type AuditAction = "create" | "update";

async function writeAudit(
  action: AuditAction,
  entityType: string,
  entityId: string | null | undefined,
  before: unknown,
  after: unknown,
): Promise<void> {
  // Best-effort: a logging failure must never block the user's edit.
  try {
    const sb = getSupabase();
    const { data } = await sb.auth.getSession();
    const session = data.session;
    if (!session) return;
    await sb.from("audit_log").insert({
      actor_id: session.user.id,
      actor_email: session.user.email ?? null,
      action,
      entity_type: entityType,
      entity_id: entityId ?? null,
      before: before ?? null,
      after: after ?? null,
    });
  } catch {
    /* swallow — audit is advisory here */
  }
}

export type UseCrudOptions = {
  /** Column to order rows by. */
  orderBy?: string;
  ascending?: boolean;
  /** Equality filters applied to every read, e.g. { scale_id, response_type }. */
  filters?: Record<string, string>;
  /** Friendly messages for the two common write violations. */
  unique?: string;
  fk?: string;
};

export function useCrud<Row extends { id: string }>(
  table: string,
  select: string,
  opts: UseCrudOptions = {},
) {
  const { orderBy, ascending = true, filters, unique, fk } = opts;
  // A stable string key so the reload callback doesn't churn on every render.
  const filterKey = filters ? JSON.stringify(filters) : "";

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    let q = getSupabase().from(table).select(select);
    const f = filterKey ? (JSON.parse(filterKey) as Record<string, string>) : null;
    if (f) for (const [k, v] of Object.entries(f)) q = q.eq(k, v);
    const { data, error: e } = await (orderBy ? q.order(orderBy, { ascending }) : q);
    setError(e ? e.message : null);
    setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
  }, [table, select, orderBy, ascending, filterKey]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; setState runs after the awaited load, not a synchronous cascade
  useEffect(() => { reload(); }, [reload]);

  const create = useCallback(
    async (values: Partial<Row>): Promise<CrudResult> => {
      // `as never`: the client is schema-untyped, so a generic Partial<Row> can't be
      // proven assignable to its insert type — the call sites stay typed as Partial<Row>.
      const { data, error: e } = await getSupabase().from(table).insert(values as never).select(select).single();
      if (e) return { ok: false, error: friendlyDbError(e as DbErr, { unique, fk }) };
      await writeAudit("create", table, (data as unknown as Row | null)?.id, null, values);
      await reload();
      return { ok: true, error: null };
    },
    [table, select, reload, unique, fk],
  );

  const update = useCallback(
    async (id: string, values: Partial<Row>): Promise<CrudResult> => {
      const before = rows.find((r) => r.id === id) ?? null;
      const { error: e } = await getSupabase().from(table).update(values as never).eq("id", id);
      if (e) return { ok: false, error: friendlyDbError(e as DbErr, { unique, fk }) };
      await writeAudit("update", table, id, before, values);
      await reload();
      return { ok: true, error: null };
    },
    [table, rows, reload, unique, fk],
  );

  const remove = useCallback(
    async (id: string): Promise<CrudResult> => {
      const before = rows.find((r) => r.id === id) ?? null;
      const { error: e } = await getSupabase().from(table).delete().eq("id", id);
      if (e) return { ok: false, error: friendlyDbError(e as DbErr, { unique, fk }) };
      await writeAudit("update", table, id, before, null); // delete → update with after:null
      await reload();
      return { ok: true, error: null };
    },
    [table, rows, reload, unique, fk],
  );

  /** Insert-or-update on a unique key (used for level descriptors). */
  const upsert = useCallback(
    async (values: Partial<Row>, onConflict: string): Promise<CrudResult> => {
      const { error: e } = await getSupabase().from(table).upsert(values as never, { onConflict });
      if (e) return { ok: false, error: friendlyDbError(e as DbErr, { unique, fk }) };
      await writeAudit("update", table, (values as { id?: string }).id, null, values);
      await reload();
      return { ok: true, error: null };
    },
    [table, reload, unique, fk],
  );

  return { rows, loading, error, reload, create, update, remove, upsert };
}
