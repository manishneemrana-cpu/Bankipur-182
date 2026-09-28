import Link from "next/link";
import { notFound } from "next/navigation";

import { getProject } from "@/lib/data/projects";
import { listLayoutVersions } from "@/lib/data/layout";

import { ImportVectorForm } from "./import-vector-form";
import { UploadForm } from "./upload-form";

export default async function LayoutPage(
  props: PageProps<"/dashboard/projects/[projectId]/layout">,
) {
  const { projectId } = await props.params;
  const [project, versions] = await Promise.all([
    getProject(projectId).catch(() => null),
    listLayoutVersions(projectId),
  ]);
  if (!project) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Layout</h1>
        <p className="text-sm text-muted-foreground">
          Upload the plot layout (PDF or image), then trace plots, roads and
          zones over it. Automatic extraction isn&apos;t wired up in this build
          — every layout is traced by hand, then reviewed and published (§7).
        </p>
      </div>

      <UploadForm projectId={projectId} />
      <ImportVectorForm projectId={projectId} />

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Versions
        </h2>
        {versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No layout uploaded yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {versions.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/dashboard/projects/${projectId}/layout/${v.id}`}
                  className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted/50"
                >
                  <span>Version {v.version_no}</span>
                  <span className="rounded-full border px-2 py-0.5 text-xs capitalize">
                    {v.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
