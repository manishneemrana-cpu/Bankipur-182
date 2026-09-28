import { notFound } from "next/navigation";

import { PlotMap } from "@/components/map2d/plot-map";
import { getMapData } from "@/lib/data/map";
import { getProject } from "@/lib/data/projects";

export default async function ProjectMapPage(
  props: PageProps<"/dashboard/projects/[projectId]/map">,
) {
  const { projectId } = await props.params;
  const [project, mapData] = await Promise.all([
    getProject(projectId).catch(() => null),
    getMapData(projectId),
  ]);
  if (!project) notFound();

  return (
    <div className="flex h-[calc(100vh-2rem)] flex-col gap-4 md:h-[calc(100vh-4rem)]">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {project.name} — Map
        </h1>
        <p className="text-sm text-muted-foreground">
          {mapData.plots.length} plots plotted. Pinch or scroll to zoom, drag to
          pan, tap a plot for details.
        </p>
      </div>
      {mapData.plots.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No plot geometry yet —{" "}
          <a
            href={`/dashboard/projects/${projectId}/layout`}
            className="underline"
          >
            upload and trace a layout
          </a>{" "}
          to add plot outlines.
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden rounded-md border">
          <PlotMap data={mapData} />
        </div>
      )}
    </div>
  );
}
