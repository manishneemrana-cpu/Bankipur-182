import { isPolygon } from "@/lib/geometry/polygon";
import type { MapLayoutData } from "@/lib/data/map";
import type { PublicSiteData } from "@/lib/data/public-site";

/** Reshapes the public RPC payload into the shape PlotMap already renders. */
export function toMapLayoutData(data: PublicSiteData): MapLayoutData {
  return {
    layoutVersionId: null,
    northAngleDeg: data.layout.north_angle_deg,
    unit: data.layout.unit,
    plots: data.plots.flatMap((p) =>
      isPolygon(p.geometry) ? [{ ...p, geometry: p.geometry }] : [],
    ),
    roads: data.roads.flatMap((r) =>
      isPolygon(r.geometry) ? [{ ...r, geometry: r.geometry }] : [],
    ),
    zones: data.zones.flatMap((z) =>
      isPolygon(z.geometry) ? [{ ...z, geometry: z.geometry }] : [],
    ),
  };
}
