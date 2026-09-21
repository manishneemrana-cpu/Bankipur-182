export default function AdminAuditLogsPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold">Audit Logs</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        The `audit_logs` table exists, but nothing writes to it yet — audit logging ships in
        Phase 11 alongside security hardening.
      </p>
    </div>
  );
}
