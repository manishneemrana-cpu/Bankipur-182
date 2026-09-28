import "server-only";

import { z } from "zod";

import { matchesAllFilters, bestCriterionToRelax } from "@/lib/search/match";
import type { SearchFilters } from "@/lib/search/parse";
import type { AreaUnit } from "@/lib/units/area";
import type { Facing } from "@/lib/geometry/types";
import type { PublicSiteData, PublicPlot } from "@/lib/data/public-site";
import type { ToolSpec } from "./provider";

const STALE_THRESHOLD_HOURS = 72;

/** Public-safe plot shape returned to the model — a subset of PublicPlot,
 * never internal notes/price (there are none in PublicSiteData to begin
 * with — the tool layer can't leak what it was never given, §12.1). */
function plotCard(p: PublicPlot) {
  return {
    plot_number: p.plot_number,
    status: p.status,
    area: p.area_official_value
      ? { value: p.area_official_value, unit: p.area_official_unit }
      : null,
    facing: p.facing,
    corner: p.corner_status,
    road_width_ft: p.road_width_primary_ft,
    price_total: p.price_visibility === "public" ? p.price_total : "on_request",
    last_inventory_update: p.last_inventory_update,
    stale:
      Date.now() - new Date(p.last_inventory_update).getTime() >
      STALE_THRESHOLD_HOURS * 60 * 60 * 1000,
  };
}

export interface SubmitLeadFn {
  (args: {
    name: string;
    phone: string;
    message: string | null;
    plotNumbers: string[];
    source: "chat";
    visitDate?: string | null;
    visitSlot?: string | null;
    visitors?: number | null;
  }): Promise<{ ok: true } | { ok: false; error: string }>;
}

const specs: ToolSpec[] = [
  {
    name: "search_plots",
    description:
      "Search available plots by area, facing, corner, minimum road width and maximum price. Always defaults to status AVAILABLE — never call this expecting sold/hold plots.",
    inputSchema: {
      type: "object",
      properties: {
        area_value: { type: "number" },
        area_unit: { type: "string" },
        facing: { type: "array", items: { type: "string" } },
        corner: { type: "boolean" },
        min_road_width_ft: { type: "number" },
        max_price_inr: { type: "number" },
      },
    },
  },
  {
    name: "get_plot",
    description: "Get full public details for one plot by its plot number.",
    inputSchema: {
      type: "object",
      properties: { plot_number: { type: "string" } },
      required: ["plot_number"],
    },
  },
  {
    name: "get_project_summary",
    description:
      "Get plot counts by status and when inventory was last updated.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_landmarks",
    description: "List nearby landmarks, optionally filtered by category.",
    inputSchema: {
      type: "object",
      properties: { category: { type: "string" } },
    },
  },
  {
    name: "get_documents",
    description: "List public project documents, optionally by kind.",
    inputSchema: { type: "object", properties: { kind: { type: "string" } } },
  },
  {
    name: "search_knowledge",
    description: "Search approved FAQs and knowledge base for an answer.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "highlight_plots",
    description:
      "UI action: highlight these plot numbers on the map. Call this whenever you present specific plots.",
    inputSchema: {
      type: "object",
      properties: {
        plot_numbers: { type: "array", items: { type: "string" } },
      },
      required: ["plot_numbers"],
    },
  },
  {
    name: "open_plot",
    description: "UI action: zoom to and open the detail panel for one plot.",
    inputSchema: {
      type: "object",
      properties: { plot_number: { type: "string" } },
      required: ["plot_number"],
    },
  },
  {
    name: "create_lead",
    description:
      "Create a sales lead. Only call this after the buyer has given their name, phone number, and explicitly agreed to be contacted (consent) — ask for all three first.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        phone: { type: "string" },
        requirement: { type: "string" },
        plot_numbers: { type: "array", items: { type: "string" } },
        consent: { type: "boolean" },
      },
      required: ["name", "phone", "consent"],
    },
  },
  {
    name: "request_site_visit",
    description:
      "Book a site visit. Only call this after the buyer has given name, phone, a preferred date, and consent.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        phone: { type: "string" },
        visit_date: { type: "string" },
        visit_slot: { type: "string" },
        visitors: { type: "number" },
        plot_numbers: { type: "array", items: { type: "string" } },
        consent: { type: "boolean" },
      },
      required: ["name", "phone", "visit_date", "consent"],
    },
  },
];

const leadArgs = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  requirement: z.string().optional(),
  plot_numbers: z.array(z.string()).optional(),
  consent: z.boolean(),
});

const visitArgs = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  visit_date: z.string(),
  visit_slot: z.string().optional(),
  visitors: z.number().optional(),
  plot_numbers: z.array(z.string()).optional(),
  consent: z.boolean(),
});

/** Builds the tool specs + executor bound to one project's live data. Every
 * tool reads only from `data` (already public-safe by construction) or
 * writes leads through `submitLead` — the model never gets a direct DB
 * handle (§12.1). */
export function buildTools(
  data: PublicSiteData,
  submitLead: SubmitLeadFn,
): {
  specs: ToolSpec[];
  execute: (name: string, input: Record<string, unknown>) => Promise<unknown>;
} {
  async function execute(
    name: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    switch (name) {
      case "search_plots": {
        const filters: SearchFilters = {
          areaValue:
            typeof input.area_value === "number" ? input.area_value : undefined,
          areaUnit: input.area_unit as AreaUnit | undefined,
          facing: Array.isArray(input.facing)
            ? (input.facing as Facing[])
            : undefined,
          corner: input.corner === true ? true : undefined,
          minRoadWidthFt:
            typeof input.min_road_width_ft === "number"
              ? input.min_road_width_ft
              : undefined,
          maxPriceInr:
            typeof input.max_price_inr === "number"
              ? input.max_price_inr
              : undefined,
        };
        const matches = data.plots.filter((p) =>
          matchesAllFilters(p, filters, data.project.state),
        );
        if (matches.length === 0) {
          const relax = bestCriterionToRelax(
            data.plots,
            filters,
            data.project.state,
          );
          return {
            count: 0,
            plots: [],
            suggestion: relax
              ? {
                  relax_criterion: relax.criterion,
                  would_match: relax.matchCount,
                }
              : null,
          };
        }
        return { count: matches.length, plots: matches.map(plotCard) };
      }
      case "get_plot": {
        const plot = data.plots.find(
          (p) => p.plot_number === input.plot_number,
        );
        return plot ? plotCard(plot) : { error: "NOT_FOUND" };
      }
      case "get_project_summary": {
        const counts: Record<string, number> = {};
        for (const p of data.plots)
          counts[p.status] = (counts[p.status] ?? 0) + 1;
        const lastUpdate = data.plots.reduce<string | null>(
          (latest, p) =>
            !latest || p.last_inventory_update > latest
              ? p.last_inventory_update
              : latest,
          null,
        );
        return { counts, last_inventory_update: lastUpdate };
      }
      case "get_landmarks": {
        const category = input.category as string | undefined;
        const landmarks = category
          ? data.landmarks.filter((l) => l.category === category)
          : data.landmarks;
        return { landmarks };
      }
      case "get_documents": {
        const kind = input.kind as string | undefined;
        const documents = kind
          ? data.documents.filter((d) => d.kind === kind)
          : data.documents;
        return {
          documents: documents.map((d) => ({
            title: d.title,
            kind: d.kind,
            verified_at: d.verified_at,
          })),
        };
      }
      case "search_knowledge": {
        // pgvector knowledge search is not wired up yet (§12.1) — report
        // honestly rather than guessing (rule 2).
        return {
          available: false,
          message: "Knowledge search is not configured for this project yet.",
        };
      }
      case "highlight_plots": {
        const numbers = Array.isArray(input.plot_numbers)
          ? (input.plot_numbers as string[])
          : [];
        const ids = data.plots
          .filter((p) => numbers.includes(p.plot_number))
          .map((p) => p.id);
        return { highlighted_plot_ids: ids };
      }
      case "open_plot": {
        const plot = data.plots.find(
          (p) => p.plot_number === input.plot_number,
        );
        return plot ? { plot_id: plot.id } : { error: "NOT_FOUND" };
      }
      case "create_lead": {
        const parsed = leadArgs.safeParse(input);
        if (!parsed.success) return { error: "INVALID_INPUT" };
        if (!parsed.data.consent) return { error: "CONSENT_REQUIRED" };
        const result = await submitLead({
          name: parsed.data.name,
          phone: parsed.data.phone,
          message: parsed.data.requirement ?? null,
          plotNumbers: parsed.data.plot_numbers ?? [],
          source: "chat",
        });
        return result;
      }
      case "request_site_visit": {
        const parsed = visitArgs.safeParse(input);
        if (!parsed.success) return { error: "INVALID_INPUT" };
        if (!parsed.data.consent) return { error: "CONSENT_REQUIRED" };
        const result = await submitLead({
          name: parsed.data.name,
          phone: parsed.data.phone,
          message: null,
          plotNumbers: parsed.data.plot_numbers ?? [],
          source: "chat",
          visitDate: parsed.data.visit_date,
          visitSlot: parsed.data.visit_slot ?? null,
          visitors: parsed.data.visitors ?? null,
        });
        return result;
      }
      default:
        return { error: "UNKNOWN_TOOL" };
    }
  }

  return { specs, execute };
}
