import { isPolygon } from "@/lib/geometry/polygon";
import type { MapLayoutData } from "@/lib/data/map";
import type { PublicSiteData } from "@/lib/data/public-site";

/** Reshapes the public RPC payload into the shape PlotMap already renders. */
export function toMapLayoutData(data: PublicSiteData): MapLayoutData {
  const { layout } = data;
  return {
    layoutVersionId: null,
    northAngleDeg: layout.north_angle_deg,
    unit: layout.unit,
    backgroundImage:
      layout.background_image_path &&
      layout.background_width_ft &&
      layout.background_height_ft
        ? {
            path: layout.background_image_path,
            widthFt: layout.background_width_ft,
            heightFt: layout.background_height_ft,
            opacity: layout.background_opacity ?? 0.45,
          }
        : null,
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
