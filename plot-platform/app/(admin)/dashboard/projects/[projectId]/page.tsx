import Link from "next/link";
import { notFound } from "next/navigation";

import { PlotStatusSelect } from "@/components/plot/status-select";
import { getProject, getProjectCounts } from "@/lib/data/projects";
import { listPlots } from "@/lib/data/plots";
import { formatIndianCurrency } from "@/lib/format";

export default async function ProjectDetailPage(
  props: PageProps<"/dashboard/projects/[projectId]">,
) {
  const { projectId } = await props.params;

  const [project, counts, plots] = await Promise.all([
    getProject(projectId).catch(() => null),
    getProjectCounts(projectId),
    listPlots(projectId),
  ]);
  if (!project) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {project.name}
            {project.is_demo ? (
              <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 align-middle text-xs dark:bg-amber-900">
                DEMO DATA
              </span>
            ) : null}
          </h1>
          <p className="text-sm text-muted-foreground">
            {project.city
              ? `${project.city}, ${project.state}`
              : "No location set"}{" "}
            · {project.status}
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link
            href={`/p/${project.slug}`}
            target="_blank"
            className="rounded-md border border-input px-3 py-1.5 hover:bg-accent"
          >
            View public site
          </Link>
          <Link
            href={`/dashboard/projects/${projectId}/leads`}
            className="rounded-md border border-input px-3 py-1.5 hover:bg-accent"
          >
            Leads
          </Link>
          <Link
            href={`/dashboard/projects/${projectId}/settings`}
            className="rounded-md border border-input px-3 py-1.5 hover:bg-accent"
          >
            Settings
          </Link>
          <Link
            href={`/dashboard/projects/${projectId}/map`}
            className="rounded-md border border-input px-3 py-1.5 hover:bg-accent"
          >
            Map
          </Link>
          <Link
            href={`/dashboard/projects/${projectId}/layout`}
            className="rounded-md border border-input px-3 py-1.5 hover:bg-accent"
          >
            Layout
          </Link>
          <Link
            href={`/dashboard/projects/${projectId}/import`}
            className="rounded-md border border-input px-3 py-1.5 hover:bg-accent"
          >
            Import inventory
          </Link>
          <Link
            href={`/dashboard/projects/${projectId}/conflicts`}
            className="rounded-md border border-input px-3 py-1.5 hover:bg-accent"
          >
            Conflicts{" "}
            {counts.openConflicts > 0 ? `(${counts.openConflicts})` : ""}
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        {Object.entries(counts.byStatus).map(([status, n]) => (
          <span key={status} className="rounded-md border px-2.5 py-1">
            {status}: <span className="tabular font-medium">{n}</span>
          </span>
        ))}
        <span className="rounded-md border px-2.5 py-1 text-muted-foreground">
          Active holds: <span className="tabular">{counts.activeHolds}</span>
        </span>
        <span className="rounded-md border px-2.5 py-1 text-muted-foreground">
          Leads: <span className="tabular">{counts.leads}</span>
        </span>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="px-3 py-2 font-medium">Plot</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Area</th>
              <th className="px-3 py-2 font-medium">Facing</th>
              <th className="px-3 py-2 font-medium">Corner</th>
              <th className="px-3 py-2 font-medium">Price</th>
              <th className="px-3 py-2 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {plots.map((p) => (
              <tr key={p.id} className="border-b border-border">
                <td className="px-3 py-2 font-medium">
                  {p.plot_number}
                  {p.area_conflict ? (
                    <span
                      title="Area has an open data conflict"
                      className="ml-1 text-destructive"
                    >
                      ⚠
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <PlotStatusSelect
                    projectId={projectId}
                    plotId={p.id}
                    status={p.status}
                  />
                </td>
                <td className="tabular px-3 py-2">
                  {p.area_official_value
                    ? `${p.area_official_value} ${p.area_official_unit}`
                    : "Not provided"}
                </td>
                <td className="px-3 py-2">{p.facing}</td>
                <td className="px-3 py-2">{p.corner_status}</td>
                <td className="tabular px-3 py-2">
                  {p.price_total
                    ? formatIndianCurrency(p.price_total)
                    : "On request"}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {new Date(p.last_inventory_update).toLocaleString("en-IN")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {plots.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No plots yet.{" "}
            <Link
              href={`/dashboard/projects/${projectId}/import`}
              className="underline"
            >
              Import inventory
            </Link>{" "}
            to add some.
          </p>
        ) : null}
      </div>
    </div>
  );
}
