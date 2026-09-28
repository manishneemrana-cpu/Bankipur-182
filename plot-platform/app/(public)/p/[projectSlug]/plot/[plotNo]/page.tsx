import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicProjectView } from "@/components/public/public-project-view";
import { getPublicSiteData } from "@/lib/data/public-site";

import { parseLang } from "../../page";
import { PasswordGate } from "../../password-gate";

export async function generateMetadata(
  props: PageProps<"/p/[projectSlug]/plot/[plotNo]">,
): Promise<Metadata> {
  const { projectSlug, plotNo } = await props.params;
  const result = await getPublicSiteData(projectSlug);
  if (!result.ok || result.data.project.visibility !== "public") {
    return { title: "Project", robots: { index: false, follow: false } };
  }
  const plot = result.data.plots.find((p) => p.plot_number === plotNo);
  if (!plot)
    return {
      title: result.data.project.name,
      robots: { index: true, follow: true },
    };

  const facts = [
    plot.area_official_value
      ? `${plot.area_official_value} ${plot.area_official_unit}`
      : null,
    plot.facing !== "UNKNOWN" ? `${plot.facing} facing` : null,
    plot.status,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    title: `Plot ${plot.plot_number} — ${result.data.project.name}`,
    description: facts || undefined,
    robots: { index: true, follow: true },
    openGraph: {
      title: `Plot ${plot.plot_number} — ${result.data.project.name}`,
      description: facts || undefined,
    },
  };
}

export default async function PlotDeepLinkPage(
  props: PageProps<"/p/[projectSlug]/plot/[plotNo]">,
) {
  const { projectSlug, plotNo } = await props.params;
  const searchParams = await props.searchParams;
  const lang = parseLang(
    typeof searchParams.lang === "string" ? searchParams.lang : undefined,
  );
  const shareRef =
    typeof searchParams.ref === "string" ? searchParams.ref : undefined;

  const result = await getPublicSiteData(projectSlug);
  if (!result.ok) {
    if (result.error === "PASSWORD_REQUIRED")
      return <PasswordGate slug={projectSlug} />;
    notFound();
  }

  const plot = result.data.plots.find((p) => p.plot_number === plotNo);
  if (!plot) notFound();

  return (
    <PublicProjectView
      data={result.data}
      lang={lang}
      projectSlug={projectSlug}
      shareRef={shareRef}
      deepLinkPlotId={plot.id}
    />
  );
}
