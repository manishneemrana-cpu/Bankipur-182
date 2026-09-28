import { type AreaUnit, isAreaUnit } from "@/lib/units/area";
import { FACINGS, type Facing } from "@/lib/geometry/types";

/**
 * Rule-based NL search parser (§4, §12.4): "1200 east corner 30 ft road
 * under 40 lakh" -> structured filters, shown back to the user as chips so
 * they see exactly how it was understood. AI fallback is a later phase.
 */
export interface SearchFilters {
  areaValue?: number;
  areaUnit?: AreaUnit;
  facing?: Facing[];
  corner?: boolean;
  minRoadWidthFt?: number;
  maxPriceInr?: number;
}

export interface SearchChip {
  key: keyof SearchFilters | "facing";
  label: string;
}

const UNIT_WORDS: Array<[RegExp, AreaUnit]> = [
  [/sq\.?\s?ft\.?|sqft|square\s?feet?/i, "sqft"],
  [/sq\.?\s?m\.?|sqm|square\s?met(?:er|re)s?/i, "sqm"],
  [/sq\.?\s?yd\.?|sqyd|gaj|square\s?yards?/i, "sqyd"],
  [/decimals?/i, "decimal"],
  [/kathas?/i, "katha"],
  [/dhurs?/i, "dhur"],
  [/katthas?/i, "kattha"],
  [/bighas?/i, "bigha"],
  [/acres?/i, "acre"],
  [/guntas?/i, "gunta"],
  [/cents?/i, "cent"],
];

// Longest / most specific first so "north east" isn't eaten by "north".
const FACING_WORDS: Array<[RegExp, Facing]> = [
  [/north\s?-?east|ne\b/i, "NE"],
  [/north\s?-?west|nw\b/i, "NW"],
  [/south\s?-?east|se\b/i, "SE"],
  [/south\s?-?west|sw\b/i, "SW"],
  [/north(?:ern)?/i, "N"],
  [/south(?:ern)?/i, "S"],
  [/east(?:ern)?/i, "E"],
  [/west(?:ern)?/i, "W"],
];

const INDIAN_MULTIPLIERS: Array<[RegExp, number]> = [
  [/crore|cr\b/i, 1_00_00_000],
  [/lakh|lac|\bl\b/i, 1_00_000],
];

/** Parses a free-text query into structured filters (never throws). */
export function parseSearchQuery(query: string): SearchFilters {
  let remaining = query.trim();
  const filters: SearchFilters = {};

  // Price: "under 40 lakh", "under 1.2cr", "below 25L".
  const priceMatch = remaining.match(
    /(?:under|below|upto|up to)\s*(?:rs\.?|₹)?\s*(\d+(?:\.\d+)?)\s*(crore|cr|lakh|lac|l)\b/i,
  );
  if (priceMatch) {
    const amount = Number(priceMatch[1]);
    const mult =
      INDIAN_MULTIPLIERS.find(([re]) => re.test(priceMatch[2]!))?.[1] ?? 1;
    filters.maxPriceInr = amount * mult;
    remaining = remaining.replace(priceMatch[0], " ");
  }

  // Road width: "30 ft road", "40 feet wide road".
  const roadMatch = remaining.match(
    /(\d+(?:\.\d+)?)\s*(?:ft\.?|feet)\s*(?:wide\s*)?road/i,
  );
  if (roadMatch) {
    filters.minRoadWidthFt = Number(roadMatch[1]);
    remaining = remaining.replace(roadMatch[0], " ");
  }

  // Corner.
  if (/\bcorner\b/i.test(remaining)) {
    filters.corner = true;
    remaining = remaining.replace(/\bcorner\b/i, " ");
  }

  // Facing (first match wins; multiple directions aren't common in one query).
  for (const [re, facing] of FACING_WORDS) {
    if (re.test(remaining)) {
      filters.facing = [facing];
      remaining = remaining.replace(re, " ");
      break;
    }
  }
  remaining = remaining.replace(/\bfacing\b/gi, " ");

  // Area: a number optionally followed by a unit word; defaults to sqft.
  const areaMatch = remaining.match(/(\d+(?:\.\d+)?)\s*([a-z.]+)?/i);
  if (areaMatch) {
    filters.areaValue = Number(areaMatch[1]);
    const unitWord = areaMatch[2] ?? "";
    const found = UNIT_WORDS.find(([re]) => re.test(unitWord));
    filters.areaUnit = found
      ? found[1]
      : isAreaUnit(unitWord)
        ? (unitWord as AreaUnit)
        : "sqft";
  }

  return filters;
}

export function filtersToChips(filters: SearchFilters): SearchChip[] {
  const chips: SearchChip[] = [];
  if (filters.areaValue) {
    chips.push({
      key: "areaValue",
      label: `${filters.areaValue} ${filters.areaUnit ?? "sqft"}`,
    });
  }
  if (filters.facing?.length)
    chips.push({ key: "facing", label: `${filters.facing.join("/")} facing` });
  if (filters.corner) chips.push({ key: "corner", label: "Corner plot" });
  if (filters.minRoadWidthFt)
    chips.push({
      key: "minRoadWidthFt",
      label: `${filters.minRoadWidthFt} ft+ road`,
    });
  if (filters.maxPriceInr)
    chips.push({
      key: "maxPriceInr",
      label: `Under ₹${formatShortInr(filters.maxPriceInr)}`,
    });
  return chips;
}

function formatShortInr(value: number): string {
  if (value >= 1_00_00_000)
    return `${(value / 1_00_00_000).toFixed(value % 1_00_00_000 ? 1 : 0)} Cr`;
  if (value >= 1_00_000)
    return `${(value / 1_00_000).toFixed(value % 1_00_000 ? 1 : 0)} L`;
  return String(value);
}

export { FACINGS };
