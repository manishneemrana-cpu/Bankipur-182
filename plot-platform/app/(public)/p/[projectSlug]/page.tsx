import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicProjectView } from "@/components/public/public-project-view";
import { getPublicSiteData } from "@/lib/data/public-site";
import type { Lang } from "@/lib/i18n/dictionary";
import { t } from "@/lib/i18n/dictionary";

import { PasswordGate } from "./password-gate";

export function parseLang(value: string | undefined): Lang {
  return value === "hi" ? "hi" : "en";
}

export async function generateMetadata(
  props: PageProps<"/p/[projectSlug]">,
): Promise<Metadata> {
  const { projectSlug } = await props.params;
  const result = await getPublicSiteData(projectSlug);

  // Rule 1 (white-label): never a platform brand in the title. Rule 17/18:
  // never leak a name before access is actually granted.
  if (!result.ok || result.data.project.visibility !== "public") {
    return { title: "Project", robots: { index: false, follow: false } };
  }
  return {
    title: result.data.project.name,
    description: result.data.project.description ?? undefined,
    robots: { index: true, follow: true },
  };
}

export default async function PublicProjectPage(
  props: PageProps<"/p/[projectSlug]">,
) {
  const { projectSlug } = await props.params;
  const searchParams = await props.searchParams;
  const lang = parseLang(
    typeof searchParams.lang === "string" ? searchParams.lang : undefined,
  );
  const shareRef =
    typeof searchParams.ref === "string" ? searchParams.ref : undefined;

  const result = await getPublicSiteData(projectSlug);

  if (!result.ok) {
    if (result.error === "NOT_FOUND") notFound();
    if (result.error === "PASSWORD_REQUIRED")
      return <PasswordGate slug={projectSlug} />;
    if (result.error === "LINK_DISABLED" || result.error === "LINK_EXPIRED") {
      return (
        <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-2 px-4 text-center">
          <h1 className="text-lg font-semibold">
            This link is no longer active
          </h1>
          <p className="text-sm text-muted-foreground">
            Please ask for an updated link.
          </p>
        </main>
      );
    }
    // UNAVAILABLE: rule 5/17 — never show cached data, say so plainly.
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-2 px-4 text-center">
        <h1 className="text-lg font-semibold">
          {t(lang, "liveAvailabilityUnavailable")}
        </h1>
      </main>
    );
  }

  return (
    <PublicProjectView
      data={result.data}
      lang={lang}
      projectSlug={projectSlug}
      shareRef={shareRef}
    />
  );
}
