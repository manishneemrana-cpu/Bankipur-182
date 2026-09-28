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
    <div className="absolute right-2 bottom-2 z-10 flex flex-col gap-1.5 rounded-xl border border-black/5 bg-background/85 p-3 text-xs shadow-md ring-1 ring-black/5 backdrop-blur-sm">
      {present.map((s) => {
        const style = statusStyle(s);
        return (
          <div key={s} className="flex items-center gap-2">
            <span
              className="inline-block size-2.5 shrink-0 rounded-full ring-1 ring-black/10"
              style={{ backgroundColor: style.fill }}
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
