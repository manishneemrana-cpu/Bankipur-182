"use client";

import { useEffect, useMemo, useState } from "react";

import { ChatWidget } from "@/components/chat/chat-widget";
import { PlotDetailPanel } from "@/components/map2d/plot-detail-panel";
import { PlotMap } from "@/components/map2d/plot-map";
import { PlotMap3DLazy } from "@/components/map3d/plot-map-3d-lazy";
import { track } from "@/lib/analytics/track";
import { toMapLayoutData } from "@/lib/data/public-map-adapter";
import { formatIndianCurrency } from "@/lib/format";
import { statusStyle } from "@/lib/map/status-colors";
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
  projectSlug,
  deepLinkPlotId,
}: {
  data: PublicSiteData;
  lang: Lang;
  projectSlug: string;
  /** Set when arriving via a /plot/[plotNo] deep link (§13, test 7). */
  deepLinkPlotId?: string | null;
}) {
  const [filters, setFilters] = useState<SearchFilters | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(
    deepLinkPlotId ?? null,
  );
  const [chatHighlightNumbers, setChatHighlightNumbers] = useState<
    string[] | null
  >(null);
  const [chatZoomPlotId, setChatZoomPlotId] = useState<string | null>(null);
  const [view, setView] = useState<"2d" | "3d">("2d");

  useEffect(() => {
    track(projectSlug, "project_view");
    // Fires once per mount — a full page load, not every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const plot = data.plots.find((p) => p.id === selectedId);
    if (plot)
      track(projectSlug, "plot_detail_open", { plotNumber: plot.plot_number });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const available = useMemo(
    () => data.plots.filter((p) => p.status === "AVAILABLE"),
    [data.plots],
  );

  const searchMatchedIds = useMemo(() => {
    if (!filters) return null;
    return new Set(
      data.plots
        .filter((p) => matchesAllFilters(p, filters, data.project.state))
        .map((p) => p.id),
    );
  }, [filters, data.plots, data.project.state]);

  // Chat-driven highlights (highlight_plots tool, §12.1) take over the map
  // highlight while active; search filters resume once chat is cleared.
  const matchedIds = useMemo(() => {
    if (chatHighlightNumbers) {
      return new Set(
        data.plots
          .filter((p) => chatHighlightNumbers.includes(p.plot_number))
          .map((p) => p.id),
      );
    }
    return searchMatchedIds;
  }, [chatHighlightNumbers, searchMatchedIds, data.plots]);

  function handleChatOpenPlot(plotNumber: string) {
    const plot = data.plots.find((p) => p.plot_number === plotNumber);
    if (!plot) return;
    setSelectedId(plot.id);
    setChatZoomPlotId(plot.id);
  }

  const comparePlots = compareIds.flatMap(
    (id) => data.plots.find((p) => p.id === id) ?? [],
  );

  function toggleCompare(plot: PublicPlot) {
    setCompareIds((prev) => {
      if (prev.includes(plot.id)) return prev.filter((id) => id !== plot.id);
      if (prev.length >= MAX_COMPARE) return prev;
      track(projectSlug, "compare_use", { plotNumber: plot.plot_number });
      return [...prev, plot.id];
    });
  }

  return (
    <>
      <section className="border-b border-border px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <SearchBar
            onChange={(f) => {
              setFilters(f);
              if (f)
                track(projectSlug, "search_query", {
                  payload: f as unknown as Record<string, unknown>,
                });
            }}
          />
        </div>
      </section>

      <section id="layout" className="border-b border-border">
        {data.plots.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            {t(lang, "notProvided")}
          </p>
        ) : (
          <>
            <div className="flex justify-end gap-1 border-b border-border p-2">
              <button
                type="button"
                onClick={() => setView("2d")}
                className={`rounded-md border px-2.5 py-1 text-xs ${view === "2d" ? "bg-primary text-primary-foreground" : ""}`}
              >
                2D
              </button>
              <button
                type="button"
                onClick={() => {
                  setView("3d");
                  track(projectSlug, "view_3d");
                }}
                className={`rounded-md border px-2.5 py-1 text-xs ${view === "3d" ? "bg-primary text-primary-foreground" : ""}`}
              >
                3D
              </button>
            </div>
            {view === "2d" ? (
              <PlotMap
                data={toMapLayoutData(data)}
                highlightIds={matchedIds}
                selectedId={selectedId}
                onSelect={setSelectedId}
                zoomToPlotId={chatZoomPlotId ?? deepLinkPlotId}
                shareContext={{
                  projectSlug: data.project.slug,
                  projectName: data.project.name,
                  whatsappPhone: data.org.contact.whatsapp,
                }}
              />
            ) : (
              <div className="flex flex-col sm:flex-row">
                <div className="min-w-0 flex-1">
                  <PlotMap3DLazy
                    data={toMapLayoutData(data)}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                  />
                </div>
                <PlotDetailPanel
                  plot={
                    toMapLayoutData(data).plots.find(
                      (p) => p.id === selectedId,
                    ) ?? null
                  }
                  unit={data.layout.unit}
                  onClose={() => setSelectedId(null)}
                  shareContext={{
                    projectSlug: data.project.slug,
                    projectName: data.project.name,
                    whatsappPhone: data.org.contact.whatsapp,
                  }}
                />
              </div>
            )}
          </>
        )}
      </section>

      <section className="border-b border-border px-4 py-8 sm:px-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <h2 className="font-display text-lg font-bold tracking-tight">
            {t(lang, "availablePlots")}
          </h2>
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t(lang, "notProvided")}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {available.map((p) => {
                const isMatch = !matchedIds || matchedIds.has(p.id);
                const inCompare = compareIds.includes(p.id);
                const style = statusStyle(p.status);
                return (
                  <div
                    key={p.id}
                    className="group cursor-pointer rounded-xl border border-black/5 bg-card p-3.5 text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    style={{ opacity: isMatch ? 1 : 0.4 }}
                    onClick={() => setSelectedId(p.id)}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <p className="font-display font-bold">{p.plot_number}</p>
                      <span
                        className="inline-block size-2 rounded-full"
                        style={{ backgroundColor: style.fill }}
                        aria-hidden
                      />
                    </div>
                    <p className="tabular text-xs text-muted-foreground">
                      {p.area_official_value
                        ? `${p.area_official_value} ${p.area_official_unit}`
                        : t(lang, "notProvided")}
                      {" · "}
                      {p.facing}
                    </p>
                    <p className="tabular mt-1 text-sm font-semibold text-primary">
                      {p.price_total
                        ? formatIndianCurrency(p.price_total)
                        : t(lang, "contactSales")}
                    </p>
                    <label
                      className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"
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
          <h2 className="font-display text-lg font-bold tracking-tight">
            Find My Plot
          </h2>
          <FindMyPlotWizard plots={data.plots} state={data.project.state} />
        </div>
      </section>

      {compareIds.length > 0 ? (
        <section
          id="compare"
          className="border-b border-border px-4 py-8 sm:px-8"
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-4">
            <h2 className="font-display text-lg font-bold tracking-tight">
              Compare
            </h2>
            <ComparePanel
              plots={comparePlots}
              onRemove={(id) =>
                setCompareIds((prev) => prev.filter((x) => x !== id))
              }
            />
          </div>
        </section>
      ) : null}

      <ChatWidget
        projectSlug={projectSlug}
        lang={lang}
        onHighlight={(numbers) => setChatHighlightNumbers(numbers)}
        onOpenPlot={handleChatOpenPlot}
      />
    </>
  );
}
