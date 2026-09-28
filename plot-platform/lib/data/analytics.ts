import "server-only";

import { createClient } from "@/lib/db/supabase/server";

export interface FunnelCounts {
  projectViews: number;
  plotDetailOpens: number;
  searchQueries: number;
  compareUses: number;
  view3dOpens: number;
  chatOpens: number;
  chatMessages: number;
  chatHandoffs: number;
  ctaCalls: number;
  ctaWhatsapp: number;
  ctaVisits: number;
  leads: number;
  siteVisits: number;
}

const FUNNEL_EVENTS: Array<[keyof FunnelCounts, string]> = [
  ["projectViews", "project_view"],
  ["plotDetailOpens", "plot_detail_open"],
  ["searchQueries", "search_query"],
  ["compareUses", "compare_use"],
  ["view3dOpens", "view_3d"],
  ["chatOpens", "chat_open"],
  ["chatMessages", "chat_message"],
  ["chatHandoffs", "chat_handoff"],
  ["ctaCalls", "cta_call"],
  ["ctaWhatsapp", "cta_whatsapp"],
  ["ctaVisits", "cta_visit"],
];

/** Funnel counts reconciled directly from analytics_events + leads/site_visits
 * — no separate rollup table, so this always matches what was recorded (§16). */
export async function getFunnelCounts(
  projectId: string,
): Promise<FunnelCounts> {
  const supabase = await createClient();

  const counts = await Promise.all(
    FUNNEL_EVENTS.map(([, event]) =>
      supabase
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("event", event)
        .then((r) => r.count ?? 0),
    ),
  );
  const [{ count: leads }, { count: siteVisits }] = await Promise.all([
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
    supabase
      .from("site_visits")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
  ]);

  const result = {} as FunnelCounts;
  FUNNEL_EVENTS.forEach(([key], i) => {
    result[key] = counts[i]!;
  });
  result.leads = leads ?? 0;
  result.siteVisits = siteVisits ?? 0;
  return result;
}

export interface PlotDemand {
  plotNumber: string;
  status: string;
  views: number;
}

/** "Most viewed" plots — labelled that, never "best" (rule: never rank as
 * best). */
export async function getMostViewedPlots(
  projectId: string,
  limit = 10,
): Promise<PlotDemand[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("analytics_events")
    .select("plot_id, plots(plot_number, status)")
    .eq("project_id", projectId)
    .eq("event", "plot_detail_open")
    .not("plot_id", "is", null);
  if (error) throw error;

  const counts = new Map<
    string,
    { plotNumber: string; status: string; views: number }
  >();
  for (const row of data ?? []) {
    const plotsField = row.plots as
      | { plot_number: string; status: string }
      | { plot_number: string; status: string }[]
      | null;
    const plot = Array.isArray(plotsField)
      ? (plotsField[0] ?? null)
      : plotsField;
    if (!plot || !row.plot_id) continue;
    const existing = counts.get(row.plot_id);
    if (existing) existing.views += 1;
    else
      counts.set(row.plot_id, {
        plotNumber: plot.plot_number,
        status: plot.status,
        views: 1,
      });
  }
  return [...counts.values()].sort((a, b) => b.views - a.views).slice(0, limit);
}

export interface DemandGapRow {
  facing: string;
  searches: number;
  availableMatching: number;
}

/** "Demand vs inventory" gap (§16): how often each facing was searched for
 * vs how many AVAILABLE plots actually face that way. */
export async function getDemandGapByFacing(
  projectId: string,
): Promise<DemandGapRow[]> {
  const supabase = await createClient();
  const [{ data: events }, { data: plots }] = await Promise.all([
    supabase
      .from("analytics_events")
      .select("payload")
      .eq("project_id", projectId)
      .eq("event", "search_query"),
    supabase.from("plots").select("facing, status").eq("project_id", projectId),
  ]);

  const searchCounts = new Map<string, number>();
  for (const row of events ?? []) {
    const payload = row.payload as { facing?: string[] } | null;
    for (const f of payload?.facing ?? []) {
      searchCounts.set(f, (searchCounts.get(f) ?? 0) + 1);
    }
  }
  const availableCounts = new Map<string, number>();
  for (const p of plots ?? []) {
    if (p.status !== "AVAILABLE") continue;
    availableCounts.set(p.facing, (availableCounts.get(p.facing) ?? 0) + 1);
  }

  return [...searchCounts.entries()]
    .map(([facing, searches]) => ({
      facing,
      searches,
      availableMatching: availableCounts.get(facing) ?? 0,
    }))
    .sort((a, b) => b.searches - a.searches);
}

export interface BrokerLeaderboardRow {
  code: string;
  label: string | null;
  clicks: number;
  leads: number;
}

export async function getBrokerLeaderboard(
  projectId: string,
): Promise<BrokerLeaderboardRow[]> {
  const supabase = await createClient();
  const [{ data: links }, { data: leadRows }] = await Promise.all([
    supabase
      .from("share_links")
      .select("id, code, label, clicks")
      .eq("project_id", projectId)
      .eq("kind", "broker"),
    supabase
      .from("leads")
      .select("share_link_id")
      .eq("project_id", projectId)
      .not("share_link_id", "is", null),
  ]);

  const leadCounts = new Map<string, number>();
  for (const l of leadRows ?? []) {
    if (!l.share_link_id) continue;
    leadCounts.set(l.share_link_id, (leadCounts.get(l.share_link_id) ?? 0) + 1);
  }

  return (links ?? [])
    .map((l) => ({
      code: l.code,
      label: l.label,
      clicks: l.clicks,
      leads: leadCounts.get(l.id) ?? 0,
    }))
    .sort((a, b) => b.leads - a.leads);
}

export interface PlanUsage {
  planName: string;
  priceInrMonthly: number;
  limits: Record<string, number>;
  usage: Record<string, number>;
}

/** Current plan + this month's usage, for the admin billing page and ops
 * console (§9, §15). */
export async function getPlanUsage(orgId: string): Promise<PlanUsage> {
  const supabase = await createClient();
  const { data: org, error } = await supabase
    .from("organizations")
    .select("plans(name, price_inr_monthly, limits)")
    .eq("id", orgId)
    .single();
  if (error) throw error;

  type PlanFields = {
    name: string;
    price_inr_monthly: number;
    limits: Record<string, number>;
  };
  const plansField = org.plans as PlanFields | PlanFields[] | null;
  const plan = Array.isArray(plansField) ? (plansField[0] ?? null) : plansField;

  const period = new Date().toISOString().slice(0, 7);
  const { data: usageRows } = await supabase
    .from("usage_counters")
    .select("metric, value")
    .eq("org_id", orgId)
    .eq("period", period);

  const { count: projectCount } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);

  const usage: Record<string, number> = { projects: projectCount ?? 0 };
  for (const row of usageRows ?? []) {
    usage[row.metric === "ai_messages" ? "ai_messages_per_month" : row.metric] =
      row.value;
  }

  return {
    planName: plan?.name ?? "Unknown",
    priceInrMonthly: plan?.price_inr_monthly ?? 0,
    limits: plan?.limits ?? {},
    usage,
  };
}
