import { notFound } from "next/navigation";

import { serverEnv } from "@/lib/env/server";
import { getProject } from "@/lib/data/projects";

import { LinkSecurityForm } from "./link-security-form";
import { LocationForm } from "./location-form";
import { PublishButton } from "./publish-button";

export default async function ProjectSettingsPage(
  props: PageProps<"/dashboard/projects/[projectId]/settings">,
) {
  const { projectId } = await props.params;
  const project = await getProject(projectId).catch(() => null);
  if (!project) notFound();

  const baseUrl = serverEnv().PUBLIC_BASE_URL;
  const embedSnippet = `<iframe src="${baseUrl}/embed/${project.slug}" width="100%" height="600" style="border:0" loading="lazy"></iframe>`;

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

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Location</h2>
        <LocationForm
          projectId={projectId}
          address={project.address}
          city={project.city}
          state={project.state}
          lat={project.lat}
          lng={project.lng}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Embed widget</h2>
        <p className="text-xs text-muted-foreground">
          Paste this into any page on your own website to embed the map (only
          works while the link security above is set to Public).
        </p>
        <textarea
          readOnly
          value={embedSnippet}
          rows={2}
          className="rounded-md border border-input p-2 font-mono text-xs"
          onFocus={(e) => e.currentTarget.select()}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Custom domain</h2>
        <p className="text-xs text-muted-foreground">
          Connecting a custom domain (e.g. plots.yourcompany.com) is a manual
          step for now — no domain-provisioning API is wired up in this build.
          Contact support to set one up; the public link above always works
          regardless.
        </p>
      </section>
    </div>
  );
}
