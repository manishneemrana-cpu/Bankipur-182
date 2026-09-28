import Link from "next/link";

import { NewProjectForm } from "@/components/forms/new-project-form";
import { listProjects } from "@/lib/data/projects";

export default async function ProjectsPage() {
  const projects = await listProjects();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
      <NewProjectForm />
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="py-2 font-medium">Name</th>
            <th className="py-2 font-medium">Location</th>
            <th className="py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id} className="border-b border-border">
              <td className="py-2">
                <Link
                  href={`/dashboard/projects/${p.id}`}
                  className="hover:underline"
                >
                  {p.name}
                </Link>
                {p.is_demo ? (
                  <span className="text-warning-foreground ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs dark:bg-amber-900">
                    DEMO DATA
                  </span>
                ) : null}
              </td>
              <td className="py-2 text-muted-foreground">
                {p.city ? `${p.city}, ${p.state}` : "—"}
              </td>
              <td className="py-2">{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No projects yet — create your first one above.
        </p>
      ) : null}
    </div>
  );
}
