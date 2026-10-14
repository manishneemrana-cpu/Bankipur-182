"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IMAGE_ROLES, LANGUAGES, PROJECT_TYPES, type ImageRole, type Language, type ProjectImage, type ProjectType } from "@ave/shared-types";
import { api, ApiError } from "@/lib/api";
import { MapPicker } from "@/components/MapPicker";
import { useAuthGuard } from "@/lib/useAuthGuard";

const TYPE_LABEL: Record<ProjectType, string> = { plot: "Plot", tower: "Tower", villa: "Villa", "2bhk": "2 BHK", "3bhk": "3 BHK", commercial: "Commercial" };
const LANG_LABEL: Record<Language, string> = { en: "English", hi: "हिन्दी", hinglish: "Hinglish" };
const ROLE_LABEL: Record<ImageRole, string> = { site_layout: "Site layout (2D)", elevation: "Elevation / render", amenity: "Amenity photo" };

export default function NewProjectPage() {
  const ready = useAuthGuard();
  const router = useRouter();
  const [f, setF] = useState({ name: "", builderName: "", tagline: "", projectType: "tower" as ProjectType, addressText: "", language: "en" as Language, customScript: "", twinUrl: "https://digital-twin-viewer-three.vercel.app/" });
  const [pos, setPos] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [images, setImages] = useState<ProjectImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => { if (ready) api.settings().then((s) => setF((x) => ({ ...x, builderName: x.builderName || s.brandKit.builderName }))).catch(() => undefined); }, [ready]);

  async function addImages(files: FileList | null) {
    if (!files) return;
    setUploading(true); setError(null);
    try {
      const next = [...images];
      for (const file of Array.from(files)) {
        if (next.length >= 5) break;
        const used = new Set(next.map((i) => i.role));
        const role: ImageRole = !used.has("elevation") ? "elevation" : !used.has("site_layout") ? "site_layout" : "amenity";
        next.push({ role, url: await api.upload(file, "image") });
      }
      setImages(next);
    } catch (e) { setError((e as Error).message); }
    setUploading(false);
  }
  function setRole(idx: number, role: ImageRole) {
    setImages((imgs) => imgs.map((im, i) => (i === idx ? { ...im, role } : role !== "amenity" && im.role === role ? { ...im, role: "amenity" } : im)));
  }

  const payload = () => ({ ...f, lat: pos.lat ?? undefined, lng: pos.lng ?? undefined, images, customScript: f.customScript.trim() || null });

  async function showPreview() {
    try { setPreview((await api.scriptPreview(payload())).sentences.join("\n")); } catch (e) { setError((e as Error).message); }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pos.lat == null || pos.lng == null) return setError("Drop a pin on the map to set the location.");
    setBusy(true); setError(null);
    try {
      const p = await api.createProject(payload());
      router.push(`/projects/${p.id}`);
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError && e.issues?.length ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" · ") : (e as Error).message);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-display text-3xl font-bold text-ink">New project</h1>

      <section className="card space-y-4 p-5">
        <h2 className="font-display text-lg font-bold">Basics</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Project name</label><input required className="input" value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div><label className="label">Builder / broker name</label><input required className="input" value={f.builderName} onChange={(e) => set("builderName", e.target.value)} /></div>
        </div>
        <div><label className="label">Tagline</label><input className="input" maxLength={200} value={f.tagline} onChange={(e) => set("tagline", e.target.value)} placeholder="Rise above the ordinary" /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Project type</label>
            <select className="input" value={f.projectType} onChange={(e) => set("projectType", e.target.value as ProjectType)}>{PROJECT_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select></div>
          <div><label className="label">Voiceover language</label>
            <div className="flex gap-1 rounded-xl border border-line bg-white p-1">{LANGUAGES.map((l) => <button type="button" key={l} onClick={() => set("language", l)} className={`flex-1 rounded-lg py-1.5 text-sm font-semibold ${f.language === l ? "bg-ink text-white" : "text-slate-600 hover:bg-slate-50"}`}>{LANG_LABEL[l]}</button>)}</div></div>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-display text-lg font-bold">Location</h2>
        <div><label className="label">Digital Twin link (optional)</label><input className="input" maxLength={500} value={f.twinUrl} onChange={(e) => set("twinUrl", e.target.value)} placeholder="https://…" /><p className="mt-1 text-xs text-slate-500">Shown as a QR code on the video's last screen and as a button on the project page.</p></div>
        <div><label className="label">Address</label><input required className="input" value={f.addressText} onChange={(e) => set("addressText", e.target.value)} placeholder="Sector 150, Noida, Uttar Pradesh" /></div>
        <MapPicker lat={pos.lat} lng={pos.lng} onPick={(lat, lng) => setPos({ lat, lng })} onAddress={(a) => !f.addressText && set("addressText", a)} />
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Latitude</label><input className="input" type="number" step="any" min={-90} max={90} value={pos.lat ?? ""} onChange={(e) => setPos((p) => ({ ...p, lat: e.target.value === "" ? null : Number(e.target.value) }))} /></div>
          <div><label className="label">Longitude</label><input className="input" type="number" step="any" min={-180} max={180} value={pos.lng ?? ""} onChange={(e) => setPos((p) => ({ ...p, lng: e.target.value === "" ? null : Number(e.target.value) }))} /></div>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Images <span className="text-sm font-normal text-slate-500">({images.length}/5)</span></h2>
          <label className={`btn btn-ghost cursor-pointer ${images.length >= 5 ? "pointer-events-none opacity-50" : ""}`}>{uploading ? "Uploading…" : "+ Add images"}
            <input type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => { addImages(e.target.files); e.target.value = ""; }} /></label>
        </div>
        <p className="text-xs text-slate-500">An <b>elevation/render</b> image becomes the cinematic building shot. Without one, the site layout gets a free pan/zoom effect instead.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((im, i) => (
            <div key={im.url} className="overflow-hidden rounded-xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={im.url} alt="" className="aspect-video w-full object-cover" />
              <div className="flex gap-1 p-2">
                <select className="input !py-1 !text-xs" value={im.role} onChange={(e) => setRole(i, e.target.value as ImageRole)}>{IMAGE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
                <button type="button" aria-label="Remove" className="px-2 text-slate-400 hover:text-red-600" onClick={() => setImages(images.filter((_, j) => j !== i))}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-display text-lg font-bold">Script <span className="text-sm font-normal text-slate-500">(optional)</span></h2>
        <textarea className="input min-h-28" maxLength={4000} value={f.customScript} onChange={(e) => set("customScript", e.target.value)} placeholder="Leave blank to auto-generate a script from the details above." />
        <div className="flex items-center gap-3">
          <button type="button" className="btn btn-ghost" onClick={showPreview}>Preview {f.customScript.trim() ? "sentences" : "auto-script"}</button>
          <span className="text-xs text-slate-500">Brand kit (logo, colors, contact number) is applied from <a className="underline" href="/settings">Settings</a>.</span>
        </div>
        {preview && <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-relaxed">{preview}</pre>}
      </section>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end"><button className="btn btn-gold" disabled={busy || uploading}>{busy ? "Submitting…" : "Generate video"}</button></div>
    </form>
  );
}
