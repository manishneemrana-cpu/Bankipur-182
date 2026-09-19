"use client";

import { useEffect, useState, use } from "react";

interface ProjectRecord {
  id: string;
  title: string;
  status: string;
}

export default function ProjectProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const headers = { "x-organization-id": "demo-org", "x-user-id": "demo-user", "x-user-role": "owner" };
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/projects/${id}`, { headers });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (!cancelled) setProject(data.project);
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

  const steps = [
    "CREATIVE_STRATEGY", "SCRIPT_WRITING", "STORYBOARD", "GENERATING_SCENES",
    "VOICE_SYNTHESIS", "CAPTION_GENERATION", "AUDIO_MIX", "FINAL_RENDERING", "COMPLETED",
  ];

  return (
    <div className="mx-auto max-w-2xl px-8 py-16 text-slate-100">
      <h1 className="text-2xl font-bold">Project {id}</h1>

      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      {project ? (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-slate-400">
            Status: <span className="font-medium text-white">{project.status}</span>
          </p>
          <ul className="space-y-2 text-sm">
            {steps.map((s) => (
              <li key={s} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                <span className={project.status === "completed" || project.status === "processing" ? "text-emerald-400" : "text-slate-500"}>
                  {project.status === "completed" ? "✓" : "○"}
                </span>
                {s.replace(/_/g, " ")}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        !error && <p className="mt-6 text-sm text-slate-500">Loading…</p>
      )}
    </div>
  );
}
