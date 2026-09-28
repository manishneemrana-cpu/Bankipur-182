import type { Metadata } from "next";

import { PlotMap } from "@/components/map2d/plot-map";
import { getPublicSiteData } from "@/lib/data/public-site";
import { toMapLayoutData } from "@/lib/data/public-map-adapter";
import { t } from "@/lib/i18n/dictionary";

export function generateMetadata(): Metadata {
  return { robots: { index: false, follow: false } };
}

/**
 * Embed widget (Phase 10, §"embed widget"): a minimal, iframe-friendly
 * version of the map for a builder to drop into their own website. Only
 * works for public (not password/unlisted-sensitive) projects — an
 * embedded iframe can't hold a password session cookie scoped correctly
 * for a third-party origin, so this deliberately doesn't try.
 */
export default async function EmbedPage(
  props: PageProps<"/embed/[projectSlug]">,
) {
  const { projectSlug } = await props.params;
  const result = await getPublicSiteData(projectSlug);

  if (!result.ok || result.data.project.visibility !== "public") {
    return (
      <main className="flex h-dvh items-center justify-center p-4 text-center text-sm text-muted-foreground">
        This project isn&apos;t available for embedding.
      </main>
    );
  }
  const { data } = result;

  return (
    <main className="flex h-dvh flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2 text-sm">
        <span className="font-medium">{data.project.name}</span>
        <a
          href={`/p/${projectSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs underline"
        >
          {t("en", "exploreLayout")}
        </a>
      </div>
      {data.plots.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          {t("en", "notProvided")}
        </p>
      ) : (
        <div className="min-h-0 flex-1">
          <PlotMap data={toMapLayoutData(data)} />
        </div>
      )}
    </main>
  );
}
