import { formatIndianCurrency } from "@/lib/format";

export interface ChatPlotCard {
  plot_number: string;
  status: string;
  area: { value: number; unit: string } | null;
  facing: string;
  corner: string;
  road_width_ft: number | null;
  price_total: number | "on_request" | null;
}

/** A plot as a UI card in the chat (§12.3) — the assistant is instructed to
 * show plots this way instead of long prose. */
export function PlotResultCard({
  plot,
  onView,
}: {
  plot: ChatPlotCard;
  onView: (plotNumber: string) => void;
}) {
  return (
    <div className="w-44 shrink-0 rounded-md border border-input p-2.5 text-xs">
      <p className="font-medium">Plot {plot.plot_number}</p>
      <p className="tabular text-muted-foreground">
        {plot.area
          ? `${plot.area.value} ${plot.area.unit}`
          : "Area not provided"}
      </p>
      <p className="text-muted-foreground">
        {plot.facing} · {plot.corner === "YES" ? "Corner" : "Non-corner"}
      </p>
      {plot.road_width_ft ? (
        <p className="text-muted-foreground">{plot.road_width_ft} ft road</p>
      ) : null}
      <p className="tabular mt-1 font-medium">
        {plot.price_total === "on_request" || plot.price_total === null
          ? "Contact sales"
          : formatIndianCurrency(plot.price_total)}
      </p>
      <button
        type="button"
        onClick={() => onView(plot.plot_number)}
        className="mt-1.5 w-full rounded-md border border-input py-1 text-xs"
      >
        View on map
      </button>
    </div>
  );
}
