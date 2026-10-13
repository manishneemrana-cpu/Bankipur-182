import type { ProjectStatus, StageStatus } from "@ave/shared-types";

const STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  queued: "bg-amber-50 text-amber-700",
  processing: "bg-blue-50 text-blue-700",
  done: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
  skipped: "bg-slate-100 text-slate-500",
};

export function StatusBadge({ status }: { status: ProjectStatus | StageStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STYLES[status]}`}>
      {status === "processing" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-600" />}
      {status}
    </span>
  );
}
