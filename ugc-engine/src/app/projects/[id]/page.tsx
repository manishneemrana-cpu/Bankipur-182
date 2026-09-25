"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";

const TENANT_HEADERS = {
  "x-organization-id": "00000000-0000-0000-0000-000000000001",
  "x-user-id": "00000000-0000-0000-0000-000000000002",
  "x-user-role": "owner",
};

interface ProjectRecord {
  id: string;
  title: string;
  status: string;
}

interface JobRecord {
  status: string;
  current_step: string;
  step_progress: number;
  error_log: string | null;
  actual_cost_usd: string;
}

interface StrategyRecord {
  selected_hook: { type: string; script: string; viralityScore: number };
  creative_angle: string;
  creative_framework: string;
  script_json: Array<{ sceneNumber: number; spokenDialogue: string; visualAction: string }>;
}

interface SceneRecord {
  scene_number: number;
  duration_seconds: number;
  purpose: string;
  video_asset_url: string | null;
  is_locked: boolean;
  qc_passed: boolean | null;
}

interface RenderRecord {
  master_video_url: string;
  subtitles_vtt_url: string;
  aspect_ratio: string;
  duration_seconds: number;
}

interface ProjectDetail {
  project: ProjectRecord;
  job: JobRecord | null;
  strategy: StrategyRecord | null;
  scenes: SceneRecord[];
  render: RenderRecord | null;
}

const STEPS = [
  "CREATIVE_STRATEGY", "SCRIPT_WRITING", "STORYBOARD", "GENERATING_SCENES",
  "VOICE_SYNTHESIS", "CAPTION_GENERATION", "AUDIO_MIX", "FINAL_RENDERING", "COMPLETED",
];

export default function ProjectProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/projects/${id}`, { headers: TENANT_HEADERS });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error);
        if (!cancelled) setData(body);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }

    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id]);

  const { project, job, strategy, scenes, render } = data ?? {};
  const isDone = project?.status === "completed" || project?.status === "failed";
  const renderIsPlayable = render?.master_video_url && !render.master_video_url.startsWith("unavailable://");

  return (
    <div className="mx-auto max-w-3xl px-8 py-12 text-slate-100">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/projects" className="text-sm text-indigo-400 hover:text-indigo-300">← All projects</Link>
        <Link href="/settings" className="text-sm text-indigo-400 hover:text-indigo-300">Settings</Link>
      </div>

      <h1 className="text-2xl font-bold">{project?.title ?? `Project ${id}`}</h1>
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {!data && !error && <p className="mt-6 text-sm text-slate-500">Loading…</p>}

      {project && (
        <div className="mt-6 space-y-8">
          <div>
            <p className="text-sm text-slate-400">
              Status: <span className="font-medium text-white">{project.status}</span>
              {job?.actual_cost_usd && Number(job.actual_cost_usd) > 0 && (
                <span className="ml-3 text-slate-500">${Number(job.actual_cost_usd).toFixed(4)} spent</span>
              )}
            </p>
            {!isDone && (
              <ul className="mt-3 space-y-2 text-sm">
                {STEPS.map((s) => {
                  const currentIdx = STEPS.indexOf(job?.current_step ?? "");
                  const stepIdx = STEPS.indexOf(s);
                  const done = currentIdx > stepIdx || (currentIdx === stepIdx && job?.status === "succeeded");
                  const active = currentIdx === stepIdx;
                  return (
                    <li
                      key={s}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${active ? "border-indigo-500/40 bg-indigo-500/10" : "border-white/10 bg-white/[0.03]"}`}
                    >
                      <span className={done ? "text-emerald-400" : active ? "text-indigo-400" : "text-slate-500"}>
                        {done ? "✓" : active ? "●" : "○"}
                      </span>
                      {s.replace(/_/g, " ")}
                    </li>
                  );
                })}
              </ul>
            )}
            {job?.status === "failed" && job.error_log && (
              <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
                {job.error_log}
              </p>
            )}
          </div>

          {render && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">Final Video</h2>
              {renderIsPlayable ? (
                <video controls className="w-full max-w-sm rounded-xl border border-white/10" src={render.master_video_url} />
              ) : (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
                  Render unavailable: {render.master_video_url.replace("unavailable://render-failed: ", "")}
                </p>
              )}
              <div className="mt-2 flex gap-4 text-xs text-slate-500">
                <span>{render.aspect_ratio} · {render.duration_seconds}s</span>
                {render.subtitles_vtt_url && (
                  <a href={render.subtitles_vtt_url} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300">
                    Captions
                  </a>
                )}
              </div>
            </section>
          )}

          {strategy && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">Creative Strategy</h2>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
                <p className="text-slate-400">
                  {strategy.creative_angle} · {strategy.creative_framework} · Hook: {strategy.selected_hook.type} (virality {strategy.selected_hook.viralityScore}/10)
                </p>
                <p className="mt-2 italic text-white">&ldquo;{strategy.selected_hook.script}&rdquo;</p>
              </div>
            </section>
          )}

          {scenes && scenes.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">Scenes ({scenes.length})</h2>
              <div className="space-y-2">
                {scenes.map((scene) => (
                  <div key={scene.scene_number} className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Scene {scene.scene_number}</span>
                      <span className="text-xs text-slate-500">{scene.duration_seconds}s</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{scene.purpose}</p>
                    {scene.video_asset_url && (
                      <a href={scene.video_asset_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-indigo-400 hover:text-indigo-300">
                        View asset →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
