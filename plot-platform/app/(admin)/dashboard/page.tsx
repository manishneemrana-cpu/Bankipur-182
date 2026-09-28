import Link from "next/link";

import { listProjects } from "@/lib/data/projects";

export default async function DashboardOverviewPage() {
  const projects = await listProjects();
  const published = projects.filter((p) => p.status === "published").length;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Projects" value={projects.length} />
        <Stat label="Published" value={published} />
        <Stat label="Draft" value={projects.length - published} />
      </div>
      <div>
        <h2 className="mb-2 text-sm font-medium">Recent projects</h2>
        <ul className="divide-y divide-border rounded-md border">
          {projects.slice(0, 5).map((p) => (
            <li key={p.id} className="p-3 text-sm">
              <Link
                href={`/dashboard/projects/${p.id}`}
                className="hover:underline"
              >
                {p.name}
              </Link>
              <span className="ml-2 text-muted-foreground">
                {p.city ? `${p.city}, ${p.state}` : "No location"} · {p.status}
              </span>
            </li>
          ))}
          {projects.length === 0 ? (
            <li className="p-3 text-sm text-muted-foreground">
              No projects yet.{" "}
              <Link href="/dashboard/projects" className="underline">
                Create one
              </Link>
              .
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="tabular text-2xl font-semibold">{value}</p>
    </div>
  );
}
