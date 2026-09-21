import { listAuditLogsForAdmin } from "@/server/audit";

export default async function AdminAuditLogsPage() {
  const logs = await listAuditLogsForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Audit Logs</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Every organization&apos;s security-relevant actions (team role changes, API key
          creation/revocation, outbound webhook changes, contact deletions), most recent first.
          Entries are immutable — nothing in the app updates or deletes an audit log row.
        </p>
      </div>

      {logs.length === 0 ? (
        <p className="text-sm text-ink-500">No audit log entries yet.</p>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Organization</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-ink-100">
                  <td className="px-4 py-3 text-ink-500">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-ink-700">{log.organizationName ?? "—"}</td>
                  <td className="px-4 py-3 font-medium text-ink-900">{log.action}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-500">
                    {log.targetType ? `${log.targetType}:${log.targetId}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
