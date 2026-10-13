import { STAGES, stageLabel, type JobRow, type Stage } from "@ave/shared-types";
import { StatusBadge } from "./StatusBadge";

const HINT: Record<Stage, string> = {
  voiceover: "Generates the script (if none given) and the voiceover",
  map: "Captures the aerial map flyby with route line and pin",
  cinematic: "Animates the elevation image into a cinematic building shot",
  render: "Composes the final video in 9:16 and 16:9",
};

export function JobProgress({ jobs }: { jobs: JobRow[] }) {
  // jobs may contain several runs (after retries); show the latest per stage
  const latest = new Map<Stage, JobRow>();
  for (const j of jobs) latest.set(j.stage, j);
  return (
    <ol className="space-y-3">
      {STAGES.map((stage, i) => {
        const j = latest.get(stage);
        const pct = j?.progress ?? 0;
        return (
          <li key={stage} className="card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">{i + 1}</span>
                <div>
                  <div className="font-semibold">{stageLabel(stage)}</div>
                  <div className="text-xs text-slate-500">{HINT[stage]}{j?.provider ? ` · ${j.provider}` : ""}</div>
                </div>
              </div>
              {j && <StatusBadge status={j.status} />}
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full transition-all ${j?.status === "failed" ? "bg-red-500" : "bg-gold"}`} style={{ width: `${j?.status === "done" || j?.status === "skipped" ? 100 : pct}%` }} />
            </div>
            {j?.error && <p className={`mt-2 text-xs ${j.status === "failed" ? "text-red-600" : "text-slate-500"}`}>{j.error}</p>}
          </li>
        );
      })}
    </ol>
  );
}
