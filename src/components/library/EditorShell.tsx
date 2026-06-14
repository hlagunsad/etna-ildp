"use client";

import { useState, type ReactNode } from "react";
import { Button, Card } from "../ui";

/** The status / error line pair every editor shows under its form. */
export function EditorStatus({ msg, error }: { msg?: string | null; error?: string | null }) {
  return (
    <>
      {msg && <span role="status" className="text-sm font-medium text-success">{msg}</span>}
      {error && <span role="alert" className="text-sm text-danger">{error}</span>}
    </>
  );
}

/**
 * A two-click inline delete. First click arms it (so a stray click can't destroy a
 * row); the second confirms. On a foreign-key failure the parent keeps the row and
 * surfaces the friendly message — there's no modal to trap focus.
 */
export function ConfirmButton({
  onConfirm,
  label = "Delete",
  confirmLabel = "Confirm delete",
  busy,
}: {
  onConfirm: () => void;
  label?: string;
  confirmLabel?: string;
  busy?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="inline-flex min-h-9 items-center rounded-xl px-2.5 text-sm font-medium text-danger transition hover:bg-danger-50"
      >
        {label}
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <Button
        type="button"
        variant="danger"
        size="sm"
        disabled={busy}
        onClick={() => {
          setArmed(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </Button>
      <Button type="button" variant="secondary" size="sm" onClick={() => setArmed(false)}>
        Cancel
      </Button>
    </span>
  );
}

/** A titled card used for an editor's add/edit form. */
export function FormCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <Card className="p-5 sm:p-6">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {hint && <p className="mb-4 mt-1 text-xs text-muted">{hint}</p>}
      <div className={hint ? "" : "mt-4"}>{children}</div>
    </Card>
  );
}

/** A titled card used for an editor's list of existing rows. */
export function ListCard({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <Card className="p-5 sm:p-6">
      <h3 className="mb-3 text-sm font-semibold text-muted">
        {title}
        {typeof count === "number" && ` (${count})`}
      </h3>
      {children}
    </Card>
  );
}
