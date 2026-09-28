"use client";

import { useState } from "react";

import { plotShareText, whatsAppUrl } from "@/lib/messaging/whatsapp";
import { statusStyle } from "@/lib/map/status-colors";
import type { MapPlot } from "@/lib/data/map";

export interface PlotShareContext {
  projectSlug: string;
  projectName: string;
  whatsappPhone?: string;
  roadWidthFt?: number | null;
}

/**
 * Plot detail: side panel on desktop, bottom sheet on mobile (§10).
 * `shareContext` (set on the buyer site) adds Share on WhatsApp / Copy link
 * (§10.1, §13); without it (admin map) the panel is read-only.
 */
export function PlotDetailPanel({
  plot,
  unit,
  onClose,
  shareContext,
}: {
  plot: MapPlot | null;
  unit: string;
  onClose: () => void;
  shareContext?: PlotShareContext;
}) {
  const [copied, setCopied] = useState(false);
  if (!plot) {
    return (
      <aside className="hidden shrink-0 border-t border-border p-4 text-sm text-muted-foreground sm:block sm:w-72 sm:border-t-0 sm:border-l">
        Tap or click a plot to see its details.
      </aside>
    );
  }

  const style = statusStyle(plot.status);

  return (
    <aside className="fixed inset-x-0 bottom-0 z-20 max-h-[45vh] overflow-y-auto rounded-t-xl border-t border-border bg-background p-4 shadow-[0_-4px_16px_rgba(0,0,0,0.1)] sm:static sm:z-auto sm:max-h-none sm:w-72 sm:shrink-0 sm:rounded-none sm:border-t-0 sm:border-l sm:shadow-none">
      <div className="mb-3 flex items-start justify-between">
        <h2 className="text-lg font-semibold">Plot {plot.plot_number}</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-muted-foreground"
        >
          Close
        </button>
      </div>

      <dl className="flex flex-col gap-2 text-sm">
        <Row label="Status">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 rounded-sm border"
              style={{ backgroundColor: style.fill, borderColor: style.stroke }}
            />
            {style.label}
          </span>
        </Row>
        <Row label="Area">
          {plot.area_official_value
            ? `${plot.area_official_value} ${plot.area_official_unit ?? unit}`
            : "Not provided"}
        </Row>
        <Row label="Facing">{plot.facing}</Row>
        <Row label="Corner">{plot.corner_status}</Row>
        {plot.dimensions.length > 0 ? (
          <Row label="Dimensions">
            {plot.dimensions
              .map((d) => `${d.side} ${d.value}${d.unit}`)
              .join(" · ")}
          </Row>
        ) : null}
      </dl>

      {shareContext ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={whatsAppUrl(
              shareContext.whatsappPhone,
              plotShareText({
                plotNumber: plot.plot_number,
                projectName: shareContext.projectName,
                areaValue: plot.area_official_value,
                areaUnit: plot.area_official_unit,
                facing: plot.facing,
                roadWidthFt: shareContext.roadWidthFt ?? null,
                deepLink:
                  typeof window !== "undefined"
                    ? `${window.location.origin}/p/${shareContext.projectSlug}/plot/${plot.plot_number}`
                    : `/p/${shareContext.projectSlug}/plot/${plot.plot_number}`,
              }),
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-input px-3 py-1.5 text-xs"
          >
            Share on WhatsApp
          </a>
          <button
            type="button"
            onClick={() => {
              const url = `${window.location.origin}/p/${shareContext.projectSlug}/plot/${plot.plot_number}`;
              navigator.clipboard.writeText(url).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
            className="rounded-md border border-input px-3 py-1.5 text-xs"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      ) : null}
    </aside>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
