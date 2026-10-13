"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Aspect, ProjectWithJobs } from "@ave/shared-types";
import { api, downloadFile } from "@/lib/api";
import { JobProgress } from "@/components/JobProgress";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuthGuard } from "@/lib/useAuthGuard";

const ASPECT_LABEL: Record<Aspect, string> = { "9:16": "9:16 · Reels / Stories", "16:9": "16:9 · YouTube / Website" };

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const ready = useAuthGuard();
  const router = useRouter();
  const [p, setP] = useState<ProjectWithJobs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aspect, setAspect] = useState<Aspect>("9:16");
  const active = p ? p.status === "queued" || p.status === "processing" : true;

  const load = useCallback(() => api.project(id).then((x) => { setP(x); setError(null); }).catch((e) => setError(e.message)), [id]);
  useEffect(() => {
    if (!ready) return;
    load();
    if (!active) return;
    const t = setInterval(load, 2500);
    return () => clearInterval(t);
  }, [ready, load, active]);

  if (error && !p) return <p className="card p-6 text-red-600">{error}</p>;
  if (!p) return <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />;
  const urls = p.assets.videoUrls ?? {};
  const slug = p.input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "video";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/" className="text-sm text-slate-500 hover:underline">← Projects</Link>
          <h1 className="mt-1 font-display text-3xl font-bold text-ink">{p.input.name}</h1>
          <p className="text-sm text-slate-500">{p.input.builderName} · {p.input.addressText}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={p.status} />
          {p.status === "failed" && <button className="btn" onClick={() => api.retry(p.id).then(setP)}>Retry</button>}
          {!active && <button className="btn btn-ghost" onClick={() => api.retry(p.id).then(setP)}>Regenerate</button>}
          <button className="btn btn-ghost text-red-600" onClick={async () => { if (confirm("Delete this project?")) { await api.remove(p.id); router.push("/"); } }}>Delete</button>
        </div>
      </div>

      {p.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{p.error}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section>
          <h2 className="mb-3 font-display text-lg font-bold">Preview</h2>
          {p.status === "done" && urls[aspect] ? (
            <div className="card p-4">
              <div className="mb-3 flex gap-1 rounded-xl border border-line bg-white p-1">
                {(["9:16", "16:9"] as const).map((a) => <button key={a} onClick={() => setAspect(a)} className={`flex-1 rounded-lg py-1.5 text-sm font-semibold ${aspect === a ? "bg-ink text-white" : "text-slate-600 hover:bg-slate-50"}`}>{ASPECT_LABEL[a]}</button>)}
              </div>
              <div className="flex justify-center rounded-xl bg-black p-2">
                <video key={urls[aspect]} src={urls[aspect]} controls playsInline poster={p.assets.thumbnailUrl} className={aspect === "9:16" ? "max-h-[70vh]" : "w-full"} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["9:16", "16:9"] as const).map((a) => urls[a] && <button key={a} className="btn btn-gold" onClick={() => downloadFile(urls[a]!, `${slug}-${a.replace(":", "x")}.mp4`)}>⬇ Download {a}</button>)}
              </div>
            </div>
          ) : (
            <div className="card flex aspect-video items-center justify-center bg-gradient-to-br from-ink to-ink-2 text-center text-white/80">
              {p.status === "failed" ? "Generation failed — see the stage details." : "Your video is being created. This page updates automatically."}
            </div>
          )}
          {p.assets.script && (
            <div className="card mt-6 p-4">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Script {p.assets.scriptTemplateId && <span className="font-normal normal-case">· {p.assets.scriptTemplateId}</span>}</h3>
              <p className="whitespace-pre-line text-sm leading-relaxed">{(p.assets.scriptSentences ?? [p.assets.script]).join("\n")}</p>
              {p.assets.voiceoverUrl && <audio className="mt-3 w-full" controls src={p.assets.voiceoverUrl} />}
            </div>
          )}
        </section>
        <aside>
          <h2 className="mb-3 font-display text-lg font-bold">Pipeline</h2>
          <JobProgress jobs={p.jobs} />
        </aside>
      </div>
    </div>
  );
}
