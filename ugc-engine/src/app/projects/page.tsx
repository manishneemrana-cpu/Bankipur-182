"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const TENANT_HEADERS = {
  "x-organization-id": "00000000-0000-0000-0000-000000000001",
  "x-user-id": "00000000-0000-0000-0000-000000000002",
  "x-user-role": "owner",
};

interface ProjectRow {
  id: string;
  title: string;
  status: string;
  created_at: string;
}

const STATUS_COLOR: Record<string, string> = {
  completed: "text-emerald-400",
  processing: "text-amber-400",
  failed: "text-red-400",
  queued: "text-slate-400",
  draft: "text-slate-500",
};

export default function ProjectsListPage() {
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/projects", { headers: TENANT_HEADERS })
      .then((r) => r.json())
      .then((data) => setProjects(data.projects))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-8 py-12 text-slate-100">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Your Projects</h1>
        <div className="flex gap-4 text-sm">
          <Link href="/settings" className="text-indigo-400 hover:text-indigo-300">Settings</Link>
          <Link href="/" className="text-indigo-400 hover:text-indigo-300">+ New</Link>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {!projects && !error && <p className="text-sm text-slate-500">Loading…</p>}
      {projects?.length === 0 && <p className="text-sm text-slate-500">No projects yet — create one from the home page.</p>}

      <div className="space-y-2">
        {projects?.map((p) => (
          <Link
            key={p.id}
            href={`/projects/${p.id}`}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 transition hover:bg-white/[0.06]"
          >
            <div>
              <p className="text-sm font-medium">{p.title}</p>
              <p className="text-xs text-slate-500">{new Date(p.created_at).toLocaleString()}</p>
            </div>
            <span className={`text-xs font-medium uppercase ${STATUS_COLOR[p.status] ?? "text-slate-400"}`}>{p.status}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
