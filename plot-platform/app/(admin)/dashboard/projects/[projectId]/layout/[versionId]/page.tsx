import { notFound } from "next/navigation";

import { TracingEditor } from "@/components/tracing/tracing-editor";
import {
  getLayoutVersion,
  listTracedPlots,
  listTracedRoads,
  listTracedZones,
} from "@/lib/data/layout";
import { getProject } from "@/lib/data/projects";

export default async function LayoutVersionPage(
  props: PageProps<"/dashboard/projects/[projectId]/layout/[versionId]">,
) {
  const { projectId, versionId } = await props.params;
  const [project, layoutVersion, plots, roads, zones] = await Promise.all([
    getProject(projectId).catch(() => null),
    getLayoutVersion(versionId).catch(() => null),
    listTracedPlots(versionId),
    listTracedRoads(versionId),
    listTracedZones(versionId),
  ]);
  if (!project || !layoutVersion) notFound();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {project.name} — Layout v{layoutVersion.version_no}
        </h1>
        <p className="text-sm text-muted-foreground">
          Calibrate the scale and north, then trace plots (click to add
          vertices, then Close polygon), roads and zones. An experienced user
          should be able to map a 100-plot layout in under 30 minutes (§7.2) —
          this build&apos;s tracer is a functional MVP of that tool, not yet the
          full Konva editor (bulk edit, snapping, split/merge are not
          implemented).
        </p>
      </div>
      <TracingEditor
        projectId={projectId}
        layoutVersion={layoutVersion}
        plots={plots}
        roads={roads}
        zones={zones}
      />
    </div>
  );
}
