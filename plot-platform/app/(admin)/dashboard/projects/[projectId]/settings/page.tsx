import { notFound } from "next/navigation";

import { getProject } from "@/lib/data/projects";

import { LinkSecurityForm } from "./link-security-form";
import { PublishButton } from "./publish-button";

export default async function ProjectSettingsPage(
  props: PageProps<"/dashboard/projects/[projectId]/settings">,
) {
  const { projectId } = await props.params;
  const project = await getProject(projectId).catch(() => null);
  if (!project) notFound();

  return (
    <div className="flex max-w-xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {project.name} — Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Publish state and link security (§9.3).
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Publish state</h2>
        <p className="text-sm">
          Status: <span className="font-medium">{project.status}</span>
        </p>
        {project.status !== "published" ? (
          <PublishButton projectId={projectId} />
        ) : null}
        <p className="text-xs text-muted-foreground">
          The public link only serves content once the project is published.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Link security</h2>
        <LinkSecurityForm
          projectId={projectId}
          visibility={project.visibility}
          linkDisabled={project.link_disabled}
          linkExpiresAt={project.link_expires_at}
        />
      </section>
    </div>
  );
}
