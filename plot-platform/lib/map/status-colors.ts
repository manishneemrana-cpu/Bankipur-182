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

// Okabe-Ito-derived colorblind-safe palette (deuteranopia/protanopia-tested
// hue spread), deepened and desaturated slightly from the textbook values
// for a calmer, more premium look (§22) — each status also differs in
// lightness, not just hue, so it still reads correctly under color
// vision deficiency even before the paired text label.
export const STATUS_STYLES: Record<PlotStatus, StatusStyle> = {
  AVAILABLE: { fill: "#2f9e58", stroke: "#1d6b3a", label: "Available" },
  HOLD: { fill: "#e0982f", stroke: "#9c6510", label: "On hold" },
  RESERVED: { fill: "#4d9fd6", stroke: "#2a6ea3", label: "Reserved" },
  BOOKED: { fill: "#2f5fa8", stroke: "#1c3d73", label: "Booked" },
  SOLD: { fill: "#7c8591", stroke: "#565d68", label: "Sold" },
  BLOCKED: { fill: "#c8570f", stroke: "#8f3c09", label: "Blocked" },
  UNAVAILABLE: { fill: "#b45f8c", stroke: "#82415f", label: "Unavailable" },
  NOT_RELEASED: { fill: "#dbdfe4", stroke: "#b0b7c0", label: "Not released" },
};

export function statusStyle(status: string): StatusStyle {
  return STATUS_STYLES[status as PlotStatus] ?? STATUS_STYLES.NOT_RELEASED;
}
