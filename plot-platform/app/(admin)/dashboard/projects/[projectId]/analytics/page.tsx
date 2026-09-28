import { notFound } from "next/navigation";

import {
  getBrokerLeaderboard,
  getDemandGapByFacing,
  getFunnelCounts,
  getMostViewedPlots,
} from "@/lib/data/analytics";
import { getProject } from "@/lib/data/projects";

export default async function ProjectAnalyticsPage(
  props: PageProps<"/dashboard/projects/[projectId]/analytics">,
) {
  const { projectId } = await props.params;
  const [project, funnel, mostViewed, demandGap, brokers] = await Promise.all([
    getProject(projectId).catch(() => null),
    getFunnelCounts(projectId),
    getMostViewedPlots(projectId),
    getDemandGapByFacing(projectId),
    getBrokerLeaderboard(projectId),
  ]);
  if (!project) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Reconciled directly from recorded events (§16) — no third-party
          trackers, no sampling.
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Funnel</h2>
        <div className="flex flex-wrap gap-3 text-sm">
          <Stat label="Project views" value={funnel.projectViews} />
          <Stat label="Plot detail opens" value={funnel.plotDetailOpens} />
          <Stat label="Search queries" value={funnel.searchQueries} />
          <Stat label="Compare uses" value={funnel.compareUses} />
          <Stat label="3D opens" value={funnel.view3dOpens} />
          <Stat label="Chat opens" value={funnel.chatOpens} />
          <Stat label="Chat messages" value={funnel.chatMessages} />
          <Stat label="Chat handoffs" value={funnel.chatHandoffs} />
          <Stat label="Call clicks" value={funnel.ctaCalls} />
          <Stat label="WhatsApp clicks" value={funnel.ctaWhatsapp} />
          <Stat label="Visit CTA clicks" value={funnel.ctaVisits} />
          <Stat label="Leads" value={funnel.leads} />
          <Stat label="Site visits booked" value={funnel.siteVisits} />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Most viewed plots
        </h2>
        {mostViewed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No plot views yet.</p>
        ) : (
          <table className="w-full max-w-md text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-1.5 font-medium">Plot</th>
                <th className="py-1.5 font-medium">Status</th>
                <th className="py-1.5 text-right font-medium">Views</th>
              </tr>
            </thead>
            <tbody>
              {mostViewed.map((p) => (
                <tr key={p.plotNumber} className="border-b border-border">
                  <td className="py-1.5">{p.plotNumber}</td>
                  <td className="py-1.5">{p.status}</td>
                  <td className="tabular py-1.5 text-right">{p.views}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Demand vs inventory (by facing)
        </h2>
        {demandGap.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No search activity yet.
          </p>
        ) : (
          <table className="w-full max-w-md text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-1.5 font-medium">Facing</th>
                <th className="py-1.5 text-right font-medium">Searches</th>
                <th className="py-1.5 text-right font-medium">
                  Available matching
                </th>
              </tr>
            </thead>
            <tbody>
              {demandGap.map((d) => (
                <tr key={d.facing} className="border-b border-border">
                  <td className="py-1.5">{d.facing}</td>
                  <td className="tabular py-1.5 text-right">{d.searches}</td>
                  <td className="tabular py-1.5 text-right">
                    {d.availableMatching}
                    {d.availableMatching === 0 ? (
                      <span className="ml-1 text-destructive">gap</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Broker leaderboard
        </h2>
        {brokers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No broker share links yet.
          </p>
        ) : (
          <table className="w-full max-w-md text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-1.5 font-medium">Broker</th>
                <th className="py-1.5 text-right font-medium">Clicks</th>
                <th className="py-1.5 text-right font-medium">Leads</th>
              </tr>
            </thead>
            <tbody>
              {brokers.map((b) => (
                <tr key={b.code} className="border-b border-border">
                  <td className="py-1.5">{b.label ?? b.code}</td>
                  <td className="tabular py-1.5 text-right">{b.clicks}</td>
                  <td className="tabular py-1.5 text-right">{b.leads}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        A weekly summary email/WhatsApp digest isn&apos;t sent in this build —
        no email/WhatsApp Business provider is configured. This page is the live
        source of the same numbers.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-md border px-2.5 py-1">
      {label}: <span className="tabular font-medium">{value}</span>
    </span>
  );
}
