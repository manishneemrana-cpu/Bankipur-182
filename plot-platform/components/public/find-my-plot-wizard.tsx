"use client";

import { useState } from "react";

import type { Facing } from "@/lib/geometry/types";
import { FACINGS } from "@/lib/geometry/types";
import {
  bestCriterionToRelax,
  matchCriteria,
  matchesAllFilters,
} from "@/lib/search/match";
import type { SearchFilters } from "@/lib/search/parse";
import type { PublicPlot } from "@/lib/data/public-site";

const CRITERION_LABEL: Record<string, string> = {
  area: "Size",
  facing: "Facing",
  corner: "Corner",
  roadWidth: "Road width",
  price: "Budget",
  available: "Available",
};

/** 5-question wizard (§9.1 item 4): size, budget, facing, corner, min road width. */
export function FindMyPlotWizard({
  plots,
  state,
}: {
  plots: PublicPlot[];
  state?: string | null;
}) {
  const [size, setSize] = useState("");
  const [budgetLakh, setBudgetLakh] = useState("");
  const [facing, setFacing] = useState<Facing | "">("");
  const [corner, setCorner] = useState(false);
  const [minRoad, setMinRoad] = useState("");
  const [submitted, setSubmitted] = useState<SearchFilters | null>(null);

  function submit() {
    const filters: SearchFilters = {};
    if (size) {
      filters.areaValue = Number(size);
      filters.areaUnit = "sqft";
    }
    if (budgetLakh) filters.maxPriceInr = Number(budgetLakh) * 100_000;
    if (facing) filters.facing = [facing];
    if (corner) filters.corner = true;
    if (minRoad) filters.minRoadWidthFt = Number(minRoad);
    setSubmitted(filters);
  }

  const matches = submitted
    ? plots.filter((p) => matchesAllFilters(p, submitted, state))
    : [];
  const relax =
    submitted && matches.length === 0
      ? bestCriterionToRelax(plots, submitted, state)
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Field label="Size (sq ft)">
          <input
            type="number"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="h-9 w-full rounded-md border border-input px-2 text-sm"
          />
        </Field>
        <Field label="Budget (₹ lakh)">
          <input
            type="number"
            value={budgetLakh}
            onChange={(e) => setBudgetLakh(e.target.value)}
            className="h-9 w-full rounded-md border border-input px-2 text-sm"
          />
        </Field>
        <Field label="Facing">
          <select
            value={facing}
            onChange={(e) => setFacing(e.target.value as Facing | "")}
            className="h-9 w-full rounded-md border border-input px-2 text-sm"
          >
            <option value="">Any</option>
            {FACINGS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Corner">
          <label className="flex h-9 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={corner}
              onChange={(e) => setCorner(e.target.checked)}
            />
            Corner only
          </label>
        </Field>
        <Field label="Min road (ft)">
          <input
            type="number"
            value={minRoad}
            onChange={(e) => setMinRoad(e.target.value)}
            className="h-9 w-full rounded-md border border-input px-2 text-sm"
          />
        </Field>
      </div>
      <button
        type="button"
        onClick={submit}
        className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Find my plot
      </button>

      {submitted ? (
        matches.length > 0 ? (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="px-3 py-2">Plot</th>
                  <th className="px-3 py-2">Matches</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((p) => {
                  const criteria = matchCriteria(p, submitted, state);
                  return (
                    <tr key={p.id} className="border-b border-border">
                      <td className="px-3 py-2 font-medium">{p.plot_number}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(criteria)
                            .filter(([k]) => k !== "available")
                            .map(([k, ok]) => (
                              <span
                                key={k}
                                className={
                                  ok
                                    ? "text-success-foreground"
                                    : "text-destructive"
                                }
                              >
                                {ok ? "✓" : "✗"} {CRITERION_LABEL[k] ?? k}
                              </span>
                            ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No exact matches.{" "}
            {relax && relax.matchCount > 0 ? (
              <>
                Try relaxing{" "}
                <strong>
                  {CRITERION_LABEL[relax.criterion] ?? relax.criterion}
                </strong>{" "}
                — {relax.matchCount} plot{relax.matchCount === 1 ? "" : "s"}{" "}
                would match.
              </>
            ) : (
              "No plots come close right now — please contact sales."
            )}
          </p>
        )
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
