"use client";
import { useEffect, useState } from "react";
import { PROVIDER_OPTIONS, type AccountSettings } from "@ave/shared-types";
import { api, type Options } from "@/lib/api";
import { useAuthGuard } from "@/lib/useAuthGuard";

const PROVIDER_LABEL: Record<string, string> = {
  elevenlabs: "ElevenLabs (eleven_multilingual_v2)", google: "Google", azure: "Azure Speech", mock: "Mock (free, no API)",
  mapbox: "Mapbox GL JS", cesium: "Cesium ion", luma: "Luma AI (Ray2)", runway: "Runway (Gen-4)", kling: "Kling AI",
};
// which env key a provider needs (for the "key set?" hint)
const KEY_FOR: Record<string, Record<string, string>> = {
  tts: { elevenlabs: "elevenlabs", google: "google_tts", azure: "azure" },
  map: { mapbox: "mapbox", google: "google_maps", cesium: "cesium" },
  video: { luma: "luma", runway: "runway", kling: "kling" },
};
const STAGES = [
  { key: "tts", title: "Stage 1 · Voiceover (TTS)" },
  { key: "map", title: "Stage 2 · Map flyby" },
  { key: "video", title: "Stage 3 · Image-to-video" },
] as const;

export default function SettingsPage() {
  const ready = useAuthGuard();
  const [s, setS] = useState<AccountSettings | null>(null);
  const [opts, setOpts] = useState<Options | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { if (ready) Promise.all([api.settings(), api.options()]).then(([a, b]) => { setS(a); setOpts(b); }).catch((e) => setError(e.message)); }, [ready]);
  if (!s || !opts) return error ? <p className="card p-6 text-red-600">{error}</p> : <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />;

  const kit = s.brandKit;
  const setKit = (patch: Partial<typeof kit>) => setS({ ...s, brandKit: { ...kit, ...patch } });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSaved(false);
    try {
      setS(await api.saveSettings({ ...s!, notifyWebhookUrl: s!.notifyWebhookUrl || null, notifyEmail: s!.notifyEmail || null }));
      setSaved(true);
    } catch (err) { setError((err as Error).message); }
  }

  return (
    <form onSubmit={save} className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-display text-3xl font-bold text-ink">Settings</h1>

      <section className="card space-y-4 p-5">
        <h2 className="font-display text-lg font-bold">Brand kit <span className="text-sm font-normal text-slate-500">· saved once, reused on every project</span></h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Builder / company name</label><input required className="input" value={kit.builderName} onChange={(e) => setKit({ builderName: e.target.value })} /></div>
          <div><label className="label">Contact number</label><input className="input" value={kit.contactNumber} onChange={(e) => setKit({ contactNumber: e.target.value })} placeholder="+91 98765 43210" /></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><label className="label">Primary color</label><div className="flex gap-2"><input type="color" className="h-10 w-12 rounded-lg border border-line" value={kit.primaryColor} onChange={(e) => setKit({ primaryColor: e.target.value })} /><input className="input" value={kit.primaryColor} onChange={(e) => setKit({ primaryColor: e.target.value })} /></div></div>
          <div><label className="label">Accent color</label><div className="flex gap-2"><input type="color" className="h-10 w-12 rounded-lg border border-line" value={kit.accentColor} onChange={(e) => setKit({ accentColor: e.target.value })} /><input className="input" value={kit.accentColor} onChange={(e) => setKit({ accentColor: e.target.value })} /></div></div>
          <div><label className="label">Logo</label>
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {kit.logoUrl ? <img src={kit.logoUrl} alt="logo" className="h-10 max-w-24 rounded bg-slate-100 object-contain p-1" /> : <span className="text-xs text-slate-400">none</span>}
              <label className="btn btn-ghost cursor-pointer !px-3 !py-1.5 text-xs">{uploading ? "…" : "Upload"}<input hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setUploading(true); try { setKit({ logoUrl: await api.upload(f, "logo") }); } catch (err) { setError((err as Error).message); } setUploading(false); }} /></label>
              {kit.logoUrl && <button type="button" className="text-xs text-slate-500 underline" onClick={() => setKit({ logoUrl: null })}>remove</button>}
            </div></div>
        </div>
        <div className="flex h-14 items-center justify-center rounded-xl text-sm font-bold tracking-widest text-white" style={{ background: kit.primaryColor }}>
          <span>{kit.builderName.toUpperCase()}</span><span className="ml-3 h-0.5 w-12" style={{ background: kit.accentColor }} />
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-display text-lg font-bold">Providers <span className="text-sm font-normal text-slate-500">· pick per stage</span></h2>
        {!opts.paidApisEnabled && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800"><b>Paid APIs are OFF</b> (<code>PAID_APIS_ENABLED=false</code>), so every provider currently returns mock output regardless of selection. Selections are saved and take effect once live calls are enabled.</p>}
        <div className="grid gap-4 sm:grid-cols-3">
          {STAGES.map(({ key, title }) => (
            <div key={key}>
              <label className="label">{title}</label>
              <select className="input" value={s.providers[key]} onChange={(e) => setS({ ...s, providers: { ...s.providers, [key]: e.target.value } as AccountSettings["providers"] })}>
                {PROVIDER_OPTIONS[key].map((id) => {
                  const keyName = KEY_FOR[key]?.[id];
                  const hint = id === "mock" ? "" : keyName && opts.keysConfigured[keyName] ? " ✓ key set" : " · no key";
                  return <option key={id} value={id}>{PROVIDER_LABEL[id] ?? id}{hint}</option>;
                })}
              </select>
            </div>
          ))}
        </div>
        <div><label className="label">Voice ID (optional)</label><input className="input" value={s.providers.voiceId} onChange={(e) => setS({ ...s, providers: { ...s.providers, voiceId: e.target.value } })} placeholder="Provider-specific voice id; blank = server default" /></div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-display text-lg font-bold">Notifications</h2>
        <p className="text-xs text-slate-500">In-app notifications are always on. Optionally also notify a webhook and/or email when a video finishes.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label">Webhook URL</label><input className="input" type="url" value={s.notifyWebhookUrl ?? ""} onChange={(e) => setS({ ...s, notifyWebhookUrl: e.target.value })} placeholder="https://…" /></div>
          <div><label className="label">Email</label><input className="input" type="email" value={s.notifyEmail ?? ""} onChange={(e) => setS({ ...s, notifyEmail: e.target.value })} placeholder="you@company.com" /></div>
        </div>
      </section>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="flex items-center justify-end gap-3">{saved && <span className="text-sm text-emerald-600">Saved ✓</span>}<button className="btn btn-gold">Save settings</button></div>
    </form>
  );
}
