"use client";

import { formatIndianCurrency } from "@/lib/format";
import type { PublicPlot } from "@/lib/data/public-site";

const ROWS: Array<{ label: string; get: (p: PublicPlot) => string }> = [
  { label: "Status", get: (p) => p.status },
  {
    label: "Area",
    get: (p) =>
      p.area_official_value
        ? `${p.area_official_value} ${p.area_official_unit}`
        : "Not provided",
  },
  { label: "Facing", get: (p) => p.facing },
  { label: "Corner", get: (p) => p.corner_status },
  {
    label: "Road width",
    get: (p) =>
      p.road_width_primary_ft
        ? `${p.road_width_primary_ft} ft`
        : "Not provided",
  },
  {
    label: "Price",
    get: (p) =>
      p.price_total ? formatIndianCurrency(p.price_total) : "Contact sales",
  },
];

/** Up to 4 plots side by side; deliberately no "best" winner (§9.1 item 5). */
export function ComparePanel({
  plots,
  onRemove,
}: {
  plots: PublicPlot[];
  onRemove: (id: string) => void;
}) {
  if (plots.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add up to 4 plots from the list above to compare.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left">
            <th className="px-3 py-2">Plot</th>
            {plots.map((p) => (
              <th key={p.id} className="px-3 py-2">
                {p.plot_number}
                <button
                  type="button"
                  onClick={() => onRemove(p.id)}
                  className="ml-2 text-xs text-muted-foreground underline"
                >
                  Remove
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.label} className="border-b border-border">
              <td className="px-3 py-2 text-muted-foreground">{row.label}</td>
              {plots.map((p) => (
                <td key={p.id} className="tabular px-3 py-2">
                  {row.get(p)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
