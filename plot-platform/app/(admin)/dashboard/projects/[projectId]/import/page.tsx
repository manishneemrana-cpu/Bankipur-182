import { notFound } from "next/navigation";

import { ImportFlow } from "@/components/import/import-flow";
import { getProject } from "@/lib/data/projects";
import { IMPORT_TEMPLATE_COLUMNS } from "@/lib/import/csv";

export default async function ImportPage(
  props: PageProps<"/dashboard/projects/[projectId]/import">,
) {
  const { projectId } = await props.params;
  const project = await getProject(projectId).catch(() => null);
  if (!project) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Import inventory
        </h1>
        <p className="text-sm text-muted-foreground">
          CSV with a header row. Only <code>plot_number</code> is required;
          every other column is optional and only overwrites what you include
          (§8).
        </p>
      </div>

      <details className="rounded-md border p-3 text-sm">
        <summary className="cursor-pointer font-medium">
          Expected columns
        </summary>
        <p className="mt-2 font-mono text-xs break-all text-muted-foreground">
          {IMPORT_TEMPLATE_COLUMNS.join(", ")}
        </p>
        <p className="mt-2 text-muted-foreground">
          Status can be AVAILABLE, RESERVED, BOOKED, SOLD, BLOCKED, UNAVAILABLE
          or NOT_RELEASED — never HOLD (a hold needs a salesperson and
          can&apos;t come from a spreadsheet).
        </p>
      </details>

      <ImportFlow projectId={projectId} />
    </div>
  );
}
