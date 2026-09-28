/**
 * Status palette (§10, §22): colorblind-safe, and status is always paired
 * with a text label — color alone never carries the meaning.
 */
export const PLOT_STATUSES = [
  "AVAILABLE",
  "HOLD",
  "RESERVED",
  "BOOKED",
  "SOLD",
  "BLOCKED",
  "UNAVAILABLE",
  "NOT_RELEASED",
] as const;

export type PlotStatus = (typeof PLOT_STATUSES)[number];

interface StatusStyle {
  fill: string;
  stroke: string;
  label: string;
}

// Okabe-Ito colorblind-safe palette, mapped so adjacent statuses (e.g. HOLD
// vs RESERVED) stay visually distinct even under deuteranopia/protanopia.
export const STATUS_STYLES: Record<PlotStatus, StatusStyle> = {
  AVAILABLE: { fill: "#33a02c", stroke: "#1f6b1a", label: "Available" },
  HOLD: { fill: "#e69f00", stroke: "#9c6c00", label: "On hold" },
  RESERVED: { fill: "#56b4e9", stroke: "#2c7ea8", label: "Reserved" },
  BOOKED: { fill: "#0072b2", stroke: "#004a73", label: "Booked" },
  SOLD: { fill: "#666666", stroke: "#3d3d3d", label: "Sold" },
  BLOCKED: { fill: "#d55e00", stroke: "#8f3f00", label: "Blocked" },
  UNAVAILABLE: { fill: "#cc79a7", stroke: "#95547a", label: "Unavailable" },
  NOT_RELEASED: { fill: "#e5e5e5", stroke: "#a3a3a3", label: "Not released" },
};

export function statusStyle(status: string): StatusStyle {
  return STATUS_STYLES[status as PlotStatus] ?? STATUS_STYLES.NOT_RELEASED;
}
