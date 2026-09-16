import { getCurrentUser } from "@/lib/data/current-user";
import { getExecutiveKpis, getAlerts } from "@/lib/data/dashboard";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatInr, formatDateTime } from "@/lib/format";

const severityVariant: Record<string, "outline" | "warning" | "destructive"> = {
  info: "outline",
  warning: "warning",
  critical: "destructive",
};

export default async function ExecutiveOverviewPage() {
  const user = await getCurrentUser();

  if (!user.organizationId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No organization assigned</CardTitle>
          <CardDescription>
            Ask an OWNER/ADMIN to assign your account to an organization.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const [kpis, alerts] = await Promise.all([
    getExecutiveKpis(user.organizationId),
    getAlerts(user.organizationId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Executive Overview</h1>
        <p className="text-muted-foreground text-sm">
          Demo-mode KPIs for {user.organizationName}. Department digests
          (Real Estate, Marketing, Automation, Finance &amp; Legal) arrive
          with the Head Agent review chain in Phase 3–4.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        <KpiCard label="Total Leads" value={kpis.totalLeads} />
        <KpiCard label="New Leads" value={kpis.newLeads} />
        <KpiCard label="Hot Leads" value={kpis.hotLeads} tone="warning" />
        <KpiCard label="Warm Leads" value={kpis.warmLeads} />
        <KpiCard label="Qualified Leads" value={kpis.qualifiedLeads} />
        <KpiCard
          label="Follow-ups Due"
          value={kpis.followupsDue}
          tone={kpis.followupsDue > 0 ? "warning" : "default"}
        />
        <KpiCard
          label="Overdue Follow-ups"
          value={kpis.overdueFollowups}
          tone={kpis.overdueFollowups > 0 ? "critical" : "default"}
        />
        <KpiCard label="Upcoming Site Visits" value={kpis.siteVisitsUpcoming} />
        <KpiCard label="New Properties (7d)" value={kpis.newPropertiesThisWeek} />
        <KpiCard label="Pending Properties" value={kpis.pendingProperties} />
        <KpiCard label="Active Brokers" value={kpis.activeBrokers} />
        <KpiCard label="Active Builders" value={kpis.activeBuilders} />
        <KpiCard label="Calls Today" value={kpis.callsToday} />
        <KpiCard label="Active Campaigns" value={kpis.activeCampaigns} />
        <KpiCard
          label="Net Revenue (demo)"
          value={formatInr(kpis.netRevenueInr)}
          tone={kpis.netRevenueInr < 0 ? "critical" : "default"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alerts</CardTitle>
          <CardDescription>
            Demo alerts across departments. Real anomaly/risk detection
            arrives with the AI Insights agent in Phase 3.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {alerts.length === 0 && (
            <p className="text-muted-foreground text-sm">No alerts.</p>
          )}
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="border-border flex flex-col gap-1 rounded-md border p-3"
            >
              <div className="flex items-center gap-2">
                <Badge variant={severityVariant[alert.severity]}>{alert.severity}</Badge>
                <span className="text-sm font-medium">{alert.title}</span>
              </div>
              <p className="text-muted-foreground text-sm">{alert.message}</p>
              <p className="text-muted-foreground text-xs">
                {formatDateTime(alert.created_at)}
                {alert.department ? ` · ${alert.department.replace("_", " ")}` : ""}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
