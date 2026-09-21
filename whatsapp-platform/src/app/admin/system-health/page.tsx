import { getSystemDiagnostics } from "@/server/diagnostics";

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
        ok ? "bg-brand-100 text-brand-800" : "bg-red-100 text-red-700"
      }`}
    >
      {label}
    </span>
  );
}

export default async function AdminSystemHealthPage() {
  const diag = await getSystemDiagnostics();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">System Health</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Raw JSON is also available at <code className="rounded bg-ink-100 px-1">/api/health</code>
          (unauthenticated, used for uptime monitoring — reports much less than this page).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-ink-400">Database</p>
          <div className="mt-2">
            <StatusPill ok={diag.database === "ok"} label={diag.database} />
          </div>
        </div>

        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-ink-400">Meta / WhatsApp</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusPill ok={diag.mockMeta} label={diag.mockMeta ? "mock mode" : "live mode"} />
            {!diag.mockMeta && <StatusPill ok={diag.meta.configured} label={diag.meta.configured ? "configured" : "missing config"} />}
          </div>
        </div>

        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-ink-400">Payments</p>
          <div className="mt-2">
            <StatusPill ok={diag.mockPayments} label={diag.mockPayments ? "mock mode" : "live mode"} />
          </div>
        </div>

        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-ink-400">Migrations applied</p>
          <p className="mt-2 text-2xl font-semibold text-ink-900">{diag.migrations.count}</p>
          <p className="mt-1 text-xs text-ink-400">latest: {diag.migrations.applied.at(-1) ?? "—"}</p>
        </div>

        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-ink-400">Organizations / Users</p>
          <p className="mt-2 text-2xl font-semibold text-ink-900">
            {diag.counts.organizations} / {diag.counts.users}
          </p>
        </div>

        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-ink-400">Inbound webhook events (24h)</p>
          <p className="mt-2 text-2xl font-semibold text-ink-900">{diag.webhookEvents.last24h}</p>
        </div>

        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-ink-400">Outbound webhook deliveries (24h)</p>
          <p className="mt-2 text-2xl font-semibold text-ink-900">
            <span className="text-brand-700">{diag.outboundWebhookDeliveries.last24hSucceeded}</span>
            {" / "}
            <span className={diag.outboundWebhookDeliveries.last24hFailed > 0 ? "text-red-600" : "text-ink-400"}>
              {diag.outboundWebhookDeliveries.last24hFailed}
            </span>
          </p>
          <p className="mt-1 text-xs text-ink-400">succeeded / failed</p>
        </div>
      </div>
    </div>
  );
}
