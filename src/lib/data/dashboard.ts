import "server-only";

import { createClient } from "@/lib/supabase/server";

export type ExecutiveKpis = {
  totalLeads: number;
  newLeads: number;
  hotLeads: number;
  warmLeads: number;
  qualifiedLeads: number;
  followupsDue: number;
  overdueFollowups: number;
  siteVisitsUpcoming: number;
  newPropertiesThisWeek: number;
  pendingProperties: number;
  activeBrokers: number;
  activeBuilders: number;
  callsToday: number;
  activeCampaigns: number;
  netRevenueInr: number;
};

export async function getExecutiveKpis(organizationId: string): Promise<ExecutiveKpis> {
  const supabase = await createClient();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const [
    totalLeadsRes,
    newLeadsRes,
    hotLeadsRes,
    warmLeadsRes,
    qualifiedLeadsRes,
    followupsDueRes,
    overdueFollowupsRes,
    siteVisitsUpcomingRes,
    newPropertiesThisWeekRes,
    pendingPropertiesRes,
    activeBrokersRes,
    activeBuildersRes,
    callsTodayRes,
    activeCampaignsRes,
    revenueRows,
  ] = await Promise.all([
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "new"),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "hot"),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "warm"),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "qualified"),
    supabase.from("followups").select("*", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "pending"),
    supabase.from("followups").select("*", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "overdue"),
    supabase.from("site_visits").select("*", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "scheduled"),
    supabase.from("properties").select("*", { count: "exact", head: true }).eq("organization_id", organizationId).gte("created_at", weekAgo),
    supabase.from("properties").select("*", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "pending"),
    supabase.from("brokers").select("*", { count: "exact", head: true }).eq("organization_id", organizationId).eq("is_active", true),
    supabase.from("builders").select("*", { count: "exact", head: true }).eq("organization_id", organizationId),
    supabase.from("calls").select("*", { count: "exact", head: true }).eq("organization_id", organizationId).gte("called_at", todayStart),
    supabase.from("campaigns").select("*", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "active"),
    supabase.from("revenue_entries").select("amount_inr").eq("organization_id", organizationId),
  ]);

  const totalLeads = totalLeadsRes.count ?? 0;
  const newLeads = newLeadsRes.count ?? 0;
  const hotLeads = hotLeadsRes.count ?? 0;
  const warmLeads = warmLeadsRes.count ?? 0;
  const qualifiedLeads = qualifiedLeadsRes.count ?? 0;
  const followupsDue = followupsDueRes.count ?? 0;
  const overdueFollowups = overdueFollowupsRes.count ?? 0;
  const siteVisitsUpcoming = siteVisitsUpcomingRes.count ?? 0;
  const newPropertiesThisWeek = newPropertiesThisWeekRes.count ?? 0;
  const pendingProperties = pendingPropertiesRes.count ?? 0;
  const activeBrokers = activeBrokersRes.count ?? 0;
  const activeBuilders = activeBuildersRes.count ?? 0;
  const callsToday = callsTodayRes.count ?? 0;
  const activeCampaigns = activeCampaignsRes.count ?? 0;

  const netRevenueInr = (revenueRows.data ?? []).reduce(
    (sum, row) => sum + Number(row.amount_inr),
    0,
  );

  return {
    totalLeads,
    newLeads,
    hotLeads,
    warmLeads,
    qualifiedLeads,
    followupsDue,
    overdueFollowups,
    siteVisitsUpcoming,
    newPropertiesThisWeek,
    pendingProperties,
    activeBrokers,
    activeBuilders,
    callsToday,
    activeCampaigns,
    netRevenueInr,
  };
}

export async function getAlerts(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("alerts")
    .select("id, severity, title, message, department, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getProperties(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("properties")
    .select(
      "id, title, property_type, city, locality, price_inr, bedrooms, area_sqft, status, verification_tier, listed_by, created_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getLeads(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select(
      "id, name, phone, source, status, assigned_to, created_at, properties(title)",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getBrokers(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("brokers")
    .select("id, name, phone, is_active, leads_count, conversions, avg_response_hours")
    .eq("organization_id", organizationId)
    .order("leads_count", { ascending: false });
  return data ?? [];
}

export async function getBuilders(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("builders")
    .select("id, name, projects_count, active_enquiries")
    .eq("organization_id", organizationId)
    .order("projects_count", { ascending: false });
  return data ?? [];
}

export async function getFollowups(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("followups")
    .select("id, due_at, status, channel, notes, leads(name)")
    .eq("organization_id", organizationId)
    .order("due_at", { ascending: true });
  return data ?? [];
}

export async function getSiteVisits(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("site_visits")
    .select("id, scheduled_at, status, leads(name), properties(title)")
    .eq("organization_id", organizationId)
    .order("scheduled_at", { ascending: true });
  return data ?? [];
}

export async function getCampaigns(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("campaigns")
    .select("id, name, platform, status, leads_generated, cost_inr, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getSocialPosts(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("social_posts")
    .select("id, platform, caption, status, scheduled_at, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getRevenueEntries(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("revenue_entries")
    .select("id, category, amount_inr, entry_date, description")
    .eq("organization_id", organizationId)
    .order("entry_date", { ascending: false });
  return data ?? [];
}

export async function getTasks(organizationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("id, title, department, priority, status, due_at")
    .eq("organization_id", organizationId)
    .order("due_at", { ascending: true });
  return data ?? [];
}
