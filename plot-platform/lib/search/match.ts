import {
  conversionTable,
  relativeDiff,
  toSqft,
  type AreaUnit,
} from "@/lib/units/area";
import type { SearchFilters } from "./parse";

/** The subset of plot fields every matcher needs — satisfied by PublicPlot/MapPlot. */
export interface MatchablePlot {
  status: string;
  area_official_value: number | null;
  area_official_unit: string | null;
  facing: string;
  corner_status: string;
  road_width_primary_ft: number | null;
  price_total: number | null;
}

export type MatchCriterion =
  "area" | "facing" | "corner" | "roadWidth" | "price" | "available";

/** Per-criterion pass/fail, so a wizard can show "which criteria each plot meets". */
export function matchCriteria(
  plot: MatchablePlot,
  filters: SearchFilters,
  state?: string | null,
): Partial<Record<MatchCriterion, boolean>> {
  const result: Partial<Record<MatchCriterion, boolean>> = {};

  result.available = plot.status === "AVAILABLE";

  if (filters.areaValue) {
    const table = conversionTable(state);
    const plotSqft =
      plot.area_official_unit && plot.area_official_value
        ? toSqft(
            plot.area_official_value,
            plot.area_official_unit as AreaUnit,
            table,
          )
        : null;
    const filterSqft = toSqft(
      filters.areaValue,
      filters.areaUnit ?? "sqft",
      table,
    );
    result.area =
      plotSqft !== null && filterSqft !== null
        ? relativeDiff(plotSqft, filterSqft) <= 0.05
        : false;
  }

  if (filters.facing?.length) {
    result.facing = filters.facing.includes(plot.facing as never);
  }

  if (filters.corner) {
    result.corner = plot.corner_status === "YES";
  }

  if (filters.minRoadWidthFt) {
    result.roadWidth =
      plot.road_width_primary_ft !== null &&
      plot.road_width_primary_ft >= filters.minRoadWidthFt;
  }

  if (filters.maxPriceInr) {
    result.price =
      plot.price_total !== null && plot.price_total <= filters.maxPriceInr;
  }

  return result;
}

/** True only if every stated criterion (including AVAILABLE, per §12.4) passes. */
export function matchesAllFilters(
  plot: MatchablePlot,
  filters: SearchFilters,
  state?: string | null,
): boolean {
  const criteria = matchCriteria(plot, filters, state);
  return Object.values(criteria).every((v) => v !== false);
}

/**
 * If nothing matches, finds the single criterion whose removal yields the
 * most matches — "offer to relax one condition" (§9.1, §12.2).
 */
export function bestCriterionToRelax<T extends MatchablePlot>(
  plots: T[],
  filters: SearchFilters,
  state?: string | null,
): { criterion: MatchCriterion; matchCount: number } | null {
  const keys = Object.keys(
    matchCriteria(plots[0] ?? ({} as T), filters, state),
  ) as MatchCriterion[];
  const relaxable = keys.filter((k) => k !== "available");
  let best: { criterion: MatchCriterion; matchCount: number } | null = null;

  for (const relax of relaxable) {
    const relaxedFilters: SearchFilters = { ...filters };
    if (relax === "area") delete relaxedFilters.areaValue;
    if (relax === "facing") delete relaxedFilters.facing;
    if (relax === "corner") delete relaxedFilters.corner;
    if (relax === "roadWidth") delete relaxedFilters.minRoadWidthFt;
    if (relax === "price") delete relaxedFilters.maxPriceInr;

    const count = plots.filter((p) =>
      matchesAllFilters(p, relaxedFilters, state),
    ).length;
    if (!best || count > best.matchCount)
      best = { criterion: relax, matchCount: count };
  }
  return best;
}
