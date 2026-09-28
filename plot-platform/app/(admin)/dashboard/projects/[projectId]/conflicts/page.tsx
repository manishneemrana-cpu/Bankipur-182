import { notFound } from "next/navigation";

import { ConflictRow } from "@/components/plot/conflict-row";
import { getProject } from "@/lib/data/projects";
import { listOpenConflicts } from "@/lib/data/plots";

export default async function ConflictsPage(
  props: PageProps<"/dashboard/projects/[projectId]/conflicts">,
) {
  const { projectId } = await props.params;
  const [project, conflicts] = await Promise.all([
    getProject(projectId).catch(() => null),
    listOpenConflicts(projectId),
  ]);
  if (!project) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Data conflicts
        </h1>
        <p className="text-sm text-muted-foreground">
          Two sources disagree on these fields (Product Contract rule 4). A
          field stays unverified until you resolve its conflict.
        </p>
      </div>

      {conflicts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No open conflicts.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {conflicts.map((c) => (
            <ConflictRow
              key={c.id}
              projectId={projectId}
              conflict={{
                id: c.id,
                field: c.field,
                note: c.note,
                values: c.values as Array<{ source: string; value: unknown }>,
                plotNumber:
                  (c.plots as unknown as { plot_number: string } | null)
                    ?.plot_number ?? null,
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
