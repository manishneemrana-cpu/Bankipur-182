"use client";

import { useMemo, useState } from "react";

import { PlotMap } from "@/components/map2d/plot-map";
import { toMapLayoutData } from "@/lib/data/public-map-adapter";
import { formatIndianCurrency } from "@/lib/format";
import type { Lang } from "@/lib/i18n/dictionary";
import { t } from "@/lib/i18n/dictionary";
import { matchesAllFilters } from "@/lib/search/match";
import type { SearchFilters } from "@/lib/search/parse";
import type { PublicSiteData, PublicPlot } from "@/lib/data/public-site";

import { ComparePanel } from "./compare-panel";
import { FindMyPlotWizard } from "./find-my-plot-wizard";
import { SearchBar } from "./search-bar";

const MAX_COMPARE = 4;

/**
 * Owns the state shared across the map, search, available-plots list and
 * compare tray so a search or a compare-add on one is reflected in the
 * others (§9.1, §10).
 */
export function SiteInteractive({
  data,
  lang,
}: {
  data: PublicSiteData;
  lang: Lang;
}) {
  const [filters, setFilters] = useState<SearchFilters | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const available = useMemo(
    () => data.plots.filter((p) => p.status === "AVAILABLE"),
    [data.plots],
  );

  const matchedIds = useMemo(() => {
    if (!filters) return null;
    return new Set(
      data.plots
        .filter((p) => matchesAllFilters(p, filters, data.project.state))
        .map((p) => p.id),
    );
  }, [filters, data.plots, data.project.state]);

  const comparePlots = compareIds.flatMap(
    (id) => data.plots.find((p) => p.id === id) ?? [],
  );

  function toggleCompare(plot: PublicPlot) {
    setCompareIds((prev) => {
      if (prev.includes(plot.id)) return prev.filter((id) => id !== plot.id);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, plot.id];
    });
  }

  return (
    <>
      <section className="border-b border-border px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <SearchBar onChange={setFilters} />
        </div>
      </section>

      <section id="layout" className="border-b border-border">
        {data.plots.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            {t(lang, "notProvided")}
          </p>
        ) : (
          <PlotMap
            data={toMapLayoutData(data)}
            highlightIds={matchedIds}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        )}
      </section>

      <section className="border-b border-border px-4 py-8 sm:px-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <h2 className="text-lg font-semibold">{t(lang, "availablePlots")}</h2>
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t(lang, "notProvided")}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {available.map((p) => {
                const isMatch = !matchedIds || matchedIds.has(p.id);
                const inCompare = compareIds.includes(p.id);
                return (
                  <div
                    key={p.id}
                    className="cursor-pointer rounded-md border p-3 text-sm"
                    style={{ opacity: isMatch ? 1 : 0.4 }}
                    onClick={() => setSelectedId(p.id)}
                  >
                    <p className="font-medium">{p.plot_number}</p>
                    <p className="tabular text-xs text-muted-foreground">
                      {p.area_official_value
                        ? `${p.area_official_value} ${p.area_official_unit}`
                        : t(lang, "notProvided")}
                    </p>
                    <p className="text-xs text-muted-foreground">{p.facing}</p>
                    <p className="tabular text-xs font-medium">
                      {p.price_total
                        ? formatIndianCurrency(p.price_total)
                        : t(lang, "contactSales")}
                    </p>
                    <label
                      className="mt-1 flex items-center gap-1.5 text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={inCompare}
                        onChange={() => toggleCompare(p)}
                      />
                      Compare
                    </label>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section
        id="find-my-plot"
        className="border-b border-border px-4 py-8 sm:px-8"
      >
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <h2 className="text-lg font-semibold">Find My Plot</h2>
          <FindMyPlotWizard plots={data.plots} state={data.project.state} />
        </div>
      </section>

      {compareIds.length > 0 ? (
        <section
          id="compare"
          className="border-b border-border px-4 py-8 sm:px-8"
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-4">
            <h2 className="text-lg font-semibold">Compare</h2>
            <ComparePanel
              plots={comparePlots}
              onRemove={(id) =>
                setCompareIds((prev) => prev.filter((x) => x !== id))
              }
            />
          </div>
        </section>
      ) : null}
    </>
  );
}
