export default function AdminSystemHealthPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold">System Health</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        Live database/webhook/queue/storage status is available now at{" "}
        <code className="rounded bg-slate-100 px-1">/api/health</code>. A friendlier dashboard
        view ships in a later phase.
      </p>
    </div>
  );
}
