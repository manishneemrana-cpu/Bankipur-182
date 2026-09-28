import { statusStyle, type PlotStatus } from "@/lib/map/status-colors";

/** Legend with live counts per status (§10) — always fed real counts, never a static key. */
export function Legend({
  counts,
  statuses,
}: {
  counts: Record<string, number>;
  statuses: readonly PlotStatus[];
}) {
  const present = statuses.filter((s) => (counts[s] ?? 0) > 0);
  if (present.length === 0) return null;

  return (
    <div className="absolute right-2 bottom-2 z-10 flex flex-col gap-1 rounded-md border border-input bg-background/90 p-2 text-xs shadow-sm">
      {present.map((s) => {
        const style = statusStyle(s);
        return (
          <div key={s} className="flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 rounded-sm border"
              style={{ backgroundColor: style.fill, borderColor: style.stroke }}
            />
            <span>
              {style.label}{" "}
              <span className="tabular text-muted-foreground">
                ({counts[s]})
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
