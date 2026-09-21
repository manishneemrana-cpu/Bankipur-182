import { getWebhookHealth } from "@/server/webhook-health";

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ok ? "bg-brand-100 text-brand-800" : "bg-red-100 text-red-700"}`}>
      {label}
    </span>
  );
}

export default async function AdminWebhooksPage() {
  const health = await getWebhookHealth();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Webhooks</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Inbound events are Meta calling this platform&apos;s webhook (new messages, status
          updates). Outbound deliveries are this platform calling an organization&apos;s own
          configured endpoint (see each org&apos;s dashboard Integrations page). Neither retries
          failed deliveries yet — see <code className="rounded bg-ink-100 px-1">docs/api.md</code>.
        </p>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-3">
          <h2 className="text-sm font-semibold text-ink-900">Inbound (Meta → this platform)</h2>
          <span className="text-xs text-ink-500">
            last 24h: {health.inbound.processedLast24h} processed, {health.inbound.failedLast24h} failed
          </span>
        </div>
        {health.inbound.recent.length === 0 ? (
          <p className="text-sm text-ink-500">No inbound webhook events yet.</p>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-400">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Organization</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {health.inbound.recent.map((e) => (
                  <tr key={e.id} className="border-t border-ink-100">
                    <td className="px-4 py-3 text-ink-500">{new Date(e.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-ink-700">{e.organizationName ?? "unknown"}</td>
                    <td className="px-4 py-3 font-medium text-ink-900">{e.eventType}</td>
                    <td className="px-4 py-3">
                      <StatusPill ok={e.processingError === null} label={e.processingError ?? (e.processed ? "processed" : "pending")} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center gap-3">
          <h2 className="text-sm font-semibold text-ink-900">Outbound (this platform → an organization&apos;s endpoint)</h2>
          <span className="text-xs text-ink-500">
            last 24h: {health.outbound.succeededLast24h} succeeded, {health.outbound.failedLast24h} failed
          </span>
        </div>
        {health.outbound.recent.length === 0 ? (
          <p className="text-sm text-ink-500">No outbound webhook deliveries yet.</p>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-400">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Organization</th>
                  <th className="px-4 py-3">URL</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {health.outbound.recent.map((d) => (
                  <tr key={d.id} className="border-t border-ink-100">
                    <td className="px-4 py-3 text-ink-500">{new Date(d.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-ink-700">{d.organizationName ?? "unknown"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-500">{d.url}</td>
                    <td className="px-4 py-3 text-ink-900">{d.eventType}</td>
                    <td className="px-4 py-3">
                      <StatusPill
                        ok={d.statusCode !== null && d.statusCode < 400}
                        label={d.statusCode === null ? "unreachable" : String(d.statusCode)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
