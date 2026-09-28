import { notFound } from "next/navigation";

import { createClient } from "@/lib/db/supabase/server";
import { getProject } from "@/lib/data/projects";

export default async function LeadsPage(
  props: PageProps<"/dashboard/projects/[projectId]/leads">,
) {
  const { projectId } = await props.params;
  const project = await getProject(projectId).catch(() => null);
  if (!project) notFound();

  const supabase = await createClient();
  const { data: leads } = await supabase
    .from("leads")
    .select("id, name, phone, email, source, stage, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {project.name} — Leads
        </h1>
        <a
          href={`/dashboard/projects/${projectId}/leads/export`}
          className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent"
        >
          Export CSV
        </a>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Stage</th>
              <th className="px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {(leads ?? []).map((l) => (
              <tr key={l.id} className="border-b border-border">
                <td className="px-3 py-2">{l.name}</td>
                <td className="px-3 py-2">{l.phone}</td>
                <td className="px-3 py-2">{l.source}</td>
                <td className="px-3 py-2">{l.stage}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {new Date(l.created_at).toLocaleString("en-IN")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(leads ?? []).length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No leads yet.</p>
        ) : null}
      </div>
    </div>
  );
}
