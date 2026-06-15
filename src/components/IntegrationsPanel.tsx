"use client";

import { useCallback, useEffect, useState } from "react";
import { apiPost } from "@/lib/api";
import { Button, Card, Pill, Spinner } from "./ui";
import { EditorStatus } from "./library/EditorShell";

type Status = { key: string; name: string; status: "configured" | "stubbed"; detail: string };

export default function IntegrationsPanel() {
  const [statuses, setStatuses] = useState<Status[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await apiPost("/api/integrations/status");
      setStatuses((r.statuses as Status[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load integration status");
      setStatuses([]);
    }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount; setState runs after the awaited load, not a synchronous cascade
  useEffect(() => { load(); }, [load]);

  async function testEmail() {
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const r = await apiPost("/api/integrations/test-send");
      const via = r.via as string;
      const to = r.to as string;
      setMsg(
        via === "logging-stub"
          ? `Logged a test email to ${to} (logging stub — no message actually sent).`
          : `Sent a test email to ${to} via ${via}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test send failed");
    }
    setBusy(false);
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">Integrations</h2>
        <Button variant="secondary" size="sm" onClick={testEmail} disabled={busy}>
          {busy ? "Sending…" : "Send test email"}
        </Button>
      </div>
      <p className="mb-4 mt-1 text-xs text-muted">
        External services. Stubbed by default — see <code className="text-[0.8em]">docs/integrations.md</code> to configure each.
      </p>
      {!statuses ? (
        <Spinner label="Loading status…" />
      ) : (
        <ul className="divide-y divide-line">
          {statuses.map((s) => (
            <li key={s.key} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0">
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{s.name}</span>
                <span className="block text-xs text-muted">{s.detail}</span>
              </span>
              <Pill tone={s.status === "configured" ? "success" : "warn"}>{s.status === "configured" ? "Configured" : "Stubbed"}</Pill>
            </li>
          ))}
        </ul>
      )}
      {(msg || error) && <div className="mt-3"><EditorStatus msg={msg} error={error} /></div>}
    </Card>
  );
}
