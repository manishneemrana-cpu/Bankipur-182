"use client";
import dynamic from "next/dynamic";
import { useState } from "react";

const Inner = dynamic(() => import("./MapPickerInner"), { ssr: false, loading: () => <div className="h-80 animate-pulse rounded-xl bg-slate-100" /> });

export function MapPicker({ lat, lng, onPick, onAddress }: { lat: number | null; lng: number | null; onPick: (lat: number, lng: number) => void; onAddress?: (a: string) => void }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Nominatim (OpenStreetMap) — free, user-initiated single lookups only (see their usage policy).
  async function search() {
    if (!q.trim()) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`);
      const [hit] = (await r.json()) as { lat: string; lon: string; display_name: string }[];
      if (!hit) setErr("No match — click the map to drop a pin instead.");
      else { onPick(Number(hit.lat), Number(hit.lon)); onAddress?.(hit.display_name); }
    } catch { setErr("Search failed — click the map to drop a pin instead."); }
    setBusy(false);
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input className="input" placeholder="Search a place (e.g. Dholera, Gujarat)" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); search(); } }} />
        <button type="button" className="btn btn-ghost shrink-0" onClick={search} disabled={busy}>{busy ? "…" : "Find"}</button>
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
      <Inner lat={lat} lng={lng} onPick={onPick} />
      <p className="text-xs text-slate-500">Click the map or drag the pin to set the exact location.</p>
    </div>
  );
}
