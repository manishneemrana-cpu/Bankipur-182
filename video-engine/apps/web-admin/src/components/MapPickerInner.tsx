"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";

interface Props {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
}

const PIN = L.divIcon({
  className: "",
  html: `<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:#c9a24b;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4);transform:rotate(-45deg) translate(2px,-2px)"></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 26],
});

/** Leaflet + OpenStreetMap tiles: free, no API key. Click the map or drag the pin to set the location. */
export default function MapPickerInner({ lat, lng, onPick }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current).setView(lat != null && lng != null ? [lat, lng] : [22.5, 79], lat != null ? 14 : 5);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => pick.current(round(e.latlng.lat), round(e.latlng.lng)));
    map.current = m;
    return () => { m.remove(); map.current = null; marker.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || lat == null || lng == null) return;
    if (!marker.current) {
      marker.current = L.marker([lat, lng], { icon: PIN, draggable: true }).addTo(m);
      marker.current.on("dragend", () => { const p = marker.current!.getLatLng(); pick.current(round(p.lat), round(p.lng)); });
    } else marker.current.setLatLng([lat, lng]);
    if (!m.getBounds().contains([lat, lng])) m.setView([lat, lng], Math.max(m.getZoom(), 13));
  }, [lat, lng]);

  return <div ref={el} className="h-80 w-full rounded-xl border border-line" />;
}
const round = (n: number) => Math.round(n * 1e6) / 1e6;
