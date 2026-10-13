"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { STAGES, stageLabel, type ProjectWithJobs } from "@ave/shared-types";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuthGuard } from "@/lib/useAuthGuard";

function currentStage(p: ProjectWithJobs) {
  const running = p.jobs.filter((j) => j.status === "processing").map((j) => stageLabel(j.stage));
  if (running.length) return running.join(" + ");
  if (p.status === "queued") return "Waiting in queue";
  const done = STAGES.filter((s) => p.jobs.some((j) => j.stage === s && (j.status === "done" || j.status === "skipped"))).length;
  return p.status === "done" ? "Both formats ready" : `${done}/${STAGES.length} stages`;
}

export default function ProjectsPage() {
  const ready = useAuthGuard();
  const [projects, setProjects] = useState<ProjectWithJobs[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    const load = () => api.projects().then((p) => { if (alive) { setProjects(p); setError(null); } }).catch((e) => alive && setError(e.message));
    load();
    const t = setInterval(load, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [ready]);

  return (
    <>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Projects</h1>
          <p className="text-sm text-slate-500">Every project becomes a luxury reel in 9:16 and 16:9.</p>
        </div>
        <Link href="/projects/new" className="btn btn-gold">+ New project</Link>
      </div>
      {error && <div className="card mb-4 border-red-200 bg-red-50 p-4 text-sm text-red-700">Can’t reach the API: {error}</div>}
      {projects?.length === 0 && (
        <div className="card p-12 text-center">
          <p className="font-display text-xl text-ink">No projects yet</p>
          <p className="mt-1 text-sm text-slate-500">Create your first project to generate a video.</p>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects?.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="card group overflow-hidden transition hover:shadow-lg">
            <div className="relative aspect-video bg-gradient-to-br from-ink to-ink-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.assets.thumbnailUrl ? <img src={p.assets.thumbnailUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center font-display text-white/60">{p.input.name}</div>}
              <div className="absolute right-3 top-3"><StatusBadge status={p.status} /></div>
            </div>
            <div className="p-4">
              <div className="font-display text-lg font-bold text-ink group-hover:text-ink-2">{p.input.name}</div>
              <div className="text-sm text-slate-500">{p.input.builderName} · {p.input.projectType.toUpperCase()} · {p.input.language}</div>
              <div className="mt-2 text-xs text-slate-400">{currentStage(p)} · {new Date(p.createdAt).toLocaleDateString()}</div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
