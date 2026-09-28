import Papa from "papaparse";
import { z } from "zod";

import { AREA_TOLERANCE, isAreaUnit, relativeDiff } from "@/lib/units/area";

/** Required CSV columns, plus every optional one the importer understands (§8). */
export const IMPORT_TEMPLATE_COLUMNS = [
  "plot_number",
  "status",
  "plot_type",
  "area_official_value",
  "area_official_unit",
  "frontage_ft",
  "depth_ft",
  "facing",
  "corner_status",
  "road_width_primary_ft",
  "price_total",
  "rate_per_unit",
  "rate_unit",
  "booking_amount",
  "block",
  "phase",
  "tags",
  "public_notes",
] as const;

const PLOT_STATUSES = [
  "AVAILABLE",
  "RESERVED",
  "BOOKED",
  "SOLD",
  "BLOCKED",
  "UNAVAILABLE",
  "NOT_RELEASED",
  // HOLD is deliberately excluded: a hold needs a holder, so it can never
  // come from a spreadsheet (enforced again in the DB by apply_inventory_import).
] as const;

const numeric = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v.trim() === "" ? undefined : v))
  .refine(
    (v) => v === undefined || !Number.isNaN(Number(v)),
    "must be a number",
  )
  .transform((v) => (v === undefined ? undefined : Number(v)));

const rowSchema = z.object({
  plot_number: z.string().trim().min(1, "plot_number is required"),
  status: z
    .string()
    .optional()
    .transform((v) => v?.trim().toUpperCase())
    .refine(
      (v) =>
        v === undefined ||
        v === "" ||
        (PLOT_STATUSES as readonly string[]).includes(v),
      {
        message: `status must be one of ${PLOT_STATUSES.join(", ")} (HOLD cannot be imported)`,
      },
    ),
  plot_type: z.string().optional(),
  area_official_value: numeric,
  area_official_unit: z
    .string()
    .optional()
    .refine((v) => !v || isAreaUnit(v), "unknown area unit"),
  frontage_ft: numeric,
  depth_ft: numeric,
  road_width_primary_ft: numeric,
  price_total: numeric,
  rate_per_unit: numeric,
  rate_unit: z.string().optional(),
  booking_amount: numeric,
  facing: z
    .string()
    .optional()
    .transform((v) => v?.trim().toUpperCase()),
  corner_status: z
    .string()
    .optional()
    .transform((v) => v?.trim().toUpperCase())
    .refine(
      (v) =>
        v === undefined || v === "" || ["YES", "NO", "UNKNOWN"].includes(v),
      {
        message: "corner_status must be YES, NO or UNKNOWN",
      },
    ),
  block: z.string().optional(),
  phase: z.string().optional(),
  tags: z.string().optional(),
  public_notes: z.string().optional(),
});

export type ImportRow = z.infer<typeof rowSchema>;

export interface RowResult {
  row: number;
  plotNumber: string;
  errors: string[];
  data?: Record<string, unknown>;
}

export interface ParsedImport {
  results: RowResult[];
  validRows: Record<string, unknown>[];
  hasErrors: boolean;
}

/** Parses + validates a CSV/plain-text buffer against the plot import shape. */
export function parseInventoryCsv(text: string): ParsedImport {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });

  const results: RowResult[] = [];
  const seenPlotNumbers = new Map<string, number>();

  parsed.data.forEach((raw, i) => {
    const rowNumber = i + 2; // header is row 1
    const plotNumber = raw.plot_number?.trim() || `(row ${rowNumber})`;
    const errors: string[] = [];

    const check = rowSchema.safeParse(raw);
    if (!check.success) {
      for (const issue of check.error.issues)
        errors.push(`${issue.path.join(".")}: ${issue.message}`);
      results.push({ row: rowNumber, plotNumber, errors });
      return;
    }

    const row = check.data;

    if (seenPlotNumbers.has(row.plot_number)) {
      errors.push(
        `duplicate plot_number (also on row ${seenPlotNumbers.get(row.plot_number)})`,
      );
    } else {
      seenPlotNumbers.set(row.plot_number, rowNumber);
    }

    if (row.price_total !== undefined && row.price_total <= 0)
      errors.push("price_total must be positive");
    if (row.booking_amount !== undefined && row.booking_amount <= 0) {
      errors.push("booking_amount must be positive");
    }
    if (
      row.area_official_value !== undefined &&
      row.area_official_unit === undefined
    ) {
      errors.push("area_official_value given without area_official_unit");
    }
    if (
      row.area_official_unit !== undefined &&
      row.area_official_value === undefined
    ) {
      errors.push("area_official_unit given without area_official_value");
    }
    if (
      row.frontage_ft !== undefined &&
      row.depth_ft !== undefined &&
      row.area_official_unit === "sqft"
    ) {
      const fromDims = row.frontage_ft * row.depth_ft;
      const official = row.area_official_value ?? fromDims;
      if (relativeDiff(fromDims, official) > AREA_TOLERANCE) {
        errors.push(
          `area (${official} sqft) does not match frontage × depth (${fromDims.toFixed(1)} sqft) beyond ${AREA_TOLERANCE * 100}% tolerance`,
        );
      }
    }

    const data: Record<string, unknown> = { plot_number: row.plot_number };
    if (row.status) data.status = row.status;
    if (row.plot_type) data.plot_type = row.plot_type;
    if (row.area_official_value !== undefined)
      data.area_official_value = row.area_official_value;
    if (row.area_official_unit)
      data.area_official_unit = row.area_official_unit;
    if (row.frontage_ft !== undefined) data.frontage_ft = row.frontage_ft;
    if (row.depth_ft !== undefined) data.depth_ft = row.depth_ft;
    if (row.road_width_primary_ft !== undefined)
      data.road_width_primary_ft = row.road_width_primary_ft;
    if (row.price_total !== undefined) data.price_total = row.price_total;
    if (row.rate_per_unit !== undefined) data.rate_per_unit = row.rate_per_unit;
    if (row.rate_unit) data.rate_unit = row.rate_unit;
    if (row.booking_amount !== undefined)
      data.booking_amount = row.booking_amount;
    if (row.facing) data.facing = row.facing;
    if (row.corner_status) data.corner_status = row.corner_status;
    if (row.block) data.block = row.block;
    if (row.phase) data.phase = row.phase;
    if (row.public_notes) data.public_notes = row.public_notes;
    if (row.tags) {
      data.tags = row.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }

    results.push({
      row: rowNumber,
      plotNumber,
      errors,
      data: errors.length === 0 ? data : undefined,
    });
  });

  return {
    results,
    validRows: results.flatMap((r) => (r.data ? [r.data] : [])),
    hasErrors: results.some((r) => r.errors.length > 0),
  };
}
