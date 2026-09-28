/**
 * Area units (§5.1). Units with a fixed legal size convert everywhere; regional
 * units (katha, dhur, bigha...) convert only when a conversion for the
 * project's state (or an org override) exists — never silently assumed.
 */
export const AREA_UNITS = [
  "sqft",
  "sqm",
  "sqyd",
  "decimal",
  "katha",
  "dhur",
  "kattha",
  "bigha",
  "acre",
  "gunta",
  "cent",
] as const;
export type AreaUnit = (typeof AREA_UNITS)[number];

export const FIXED_SQFT_PER_UNIT: Partial<Record<AreaUnit, number>> = {
  sqft: 1,
  sqm: 10.763910417,
  sqyd: 9,
  acre: 43560,
  decimal: 435.6, // 1/100 acre
  cent: 435.6, // 1/100 acre
  gunta: 1089, // 1/40 acre
};

/** Platform templates per state; org admins can override (area_unit_conversions). */
export const STATE_SQFT_PER_UNIT: Record<
  string,
  Partial<Record<AreaUnit, number>>
> = {
  Bihar: { katha: 1361.25, kattha: 1361.25, dhur: 68.0625, bigha: 27225 },
  "West Bengal": { katha: 720, kattha: 720, bigha: 14400 },
  Jharkhand: { katha: 1361.25, kattha: 1361.25, dhur: 68.0625, bigha: 27225 },
  Assam: { katha: 2880, bigha: 14400 },
};

export const UNIT_LABELS: Record<AreaUnit, { en: string; hi: string }> = {
  sqft: { en: "sq ft", hi: "वर्ग फुट" },
  sqm: { en: "sq m", hi: "वर्ग मीटर" },
  sqyd: { en: "sq yd (gaj)", hi: "वर्ग गज" },
  decimal: { en: "decimal", hi: "डिसमिल" },
  katha: { en: "katha", hi: "कट्ठा" },
  dhur: { en: "dhur", hi: "धुर" },
  kattha: { en: "kattha", hi: "कट्ठा" },
  bigha: { en: "bigha", hi: "बीघा" },
  acre: { en: "acre", hi: "एकड़" },
  gunta: { en: "gunta", hi: "गुंठा" },
  cent: { en: "cent", hi: "सेंट" },
};

export type ConversionTable = Partial<Record<AreaUnit, number>>;

/** Builds the effective table: fixed units, then state template, then org overrides. */
export function conversionTable(
  state?: string | null,
  overrides: ConversionTable = {},
): ConversionTable {
  return {
    ...FIXED_SQFT_PER_UNIT,
    ...(state ? STATE_SQFT_PER_UNIT[state] : undefined),
    ...overrides,
  };
}

/** Returns sq ft, or null when the unit has no known conversion for this project. */
export function toSqft(
  value: number,
  unit: AreaUnit,
  table: ConversionTable,
): number | null {
  const f = table[unit];
  return f ? value * f : null;
}

export function fromSqft(
  sqft: number,
  unit: AreaUnit,
  table: ConversionTable,
): number | null {
  const f = table[unit];
  return f ? sqft / f : null;
}

export function isAreaUnit(u: string): u is AreaUnit {
  return (AREA_UNITS as readonly string[]).includes(u);
}

/** Relative difference, e.g. 0.04 for 4%. */
export function relativeDiff(a: number, b: number): number {
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b));
}

/** Default area tolerance before a conflict is raised (§6). */
export const AREA_TOLERANCE = 0.02;
