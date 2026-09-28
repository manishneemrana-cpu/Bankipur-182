import Link from "next/link";

import { LeadForm } from "@/components/lead/lead-form";
import { EmiCalculator } from "@/components/public/emi-calculator";
import { SiteInteractive } from "@/components/public/site-interactive";
import { StickyActionBar } from "@/components/public/sticky-action-bar";
import type { PublicSiteData } from "@/lib/data/public-site";
import type { Lang } from "@/lib/i18n/dictionary";
import { t } from "@/lib/i18n/dictionary";

/** The full buyer site body (§9.1), shared by the project page and plot deep links. */
export function PublicProjectView({
  data,
  lang,
  projectSlug,
  shareRef,
  deepLinkPlotId,
}: {
  data: PublicSiteData;
  lang: Lang;
  projectSlug: string;
  shareRef?: string;
  deepLinkPlotId?: string | null;
}) {
  const { project, org, plots, landmarks, faqs, documents } = data;
  const available = plots.filter((p) => p.status === "AVAILABLE");
  const lastUpdate = plots.reduce<string | null>(
    (latest, p) =>
      !latest || p.last_inventory_update > latest
        ? p.last_inventory_update
        : latest,
    null,
  );
  const langFaqs = faqs.filter((f) => f.lang === lang);
  const examplePlot = available.find((p) => p.price_total);

  return (
    <>
      {project.is_demo ? (
        <div className="bg-warning py-1 text-center text-xs font-semibold text-black">
          {t(lang, "demoDataRibbon")}
        </div>
      ) : null}

      <main className="pb-16 sm:pb-0">
        {/* Hero */}
        <section className="border-b border-border px-4 py-8 sm:px-8">
          <div className="mx-auto flex max-w-5xl flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  {project.name}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {[project.address, project.city, project.state]
                    .filter(Boolean)
                    .join(", ") || t(lang, "notProvided")}
                </p>
              </div>
              <div className="flex gap-1 text-xs">
                <Link
                  href={`/p/${projectSlug}?lang=en`}
                  className={
                    lang === "en"
                      ? "font-semibold underline"
                      : "text-muted-foreground"
                  }
                >
                  EN
                </Link>
                <span className="text-muted-foreground">·</span>
                <Link
                  href={`/p/${projectSlug}?lang=hi`}
                  className={
                    lang === "hi"
                      ? "font-semibold underline"
                      : "text-muted-foreground"
                  }
                >
                  हिं
                </Link>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <Stat label={t(lang, "totalArea")}>
                {project.total_area_value
                  ? `${project.total_area_value} ${project.total_area_unit}`
                  : t(lang, "notProvided")}
              </Stat>
              <Stat label={t(lang, "totalPlots")}>{plots.length}</Stat>
              <Stat label={t(lang, "availableNow")}>
                {available.length}
                {lastUpdate ? (
                  <span className="ml-1 font-normal text-muted-foreground">
                    · {t(lang, "updated")}{" "}
                    {new Date(lastUpdate).toLocaleString(
                      lang === "hi" ? "hi-IN" : "en-IN",
                    )}
                  </span>
                ) : null}
              </Stat>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href="#layout"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                {t(lang, "exploreLayout")}
              </a>
              <a
                href="#site-visit"
                className="rounded-md border border-input px-4 py-2 text-sm font-medium"
              >
                {t(lang, "bookSiteVisit")}
              </a>
            </div>
          </div>
        </section>

        {/* Interactive Master Plan, Available Plots, Find My Plot, Compare (§9.1, §4) */}
        <SiteInteractive
          data={data}
          lang={lang}
          projectSlug={projectSlug}
          deepLinkPlotId={deepLinkPlotId}
        />

        {/* Location */}
        <section
          id="location"
          className="border-b border-border px-4 py-8 sm:px-8"
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-4">
            <h2 className="text-lg font-semibold">{t(lang, "location")}</h2>
            {project.lat && project.lng ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${project.lat},${project.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline underline-offset-4"
              >
                View on Google Maps
              </a>
            ) : null}
            {landmarks.length > 0 ? (
              <ul className="flex flex-col gap-1 text-sm">
                {landmarks.map((l) => (
                  <li key={l.id} className="flex justify-between gap-3">
                    <span>{l.name}</span>
                    <span className="tabular text-xs text-muted-foreground">
                      {l.distance_value
                        ? `${l.distance_value} ${l.distance_unit}`
                        : t(lang, "notProvided")}
                      {l.distance_source === "calculated"
                        ? " (approx., calculated)"
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t(lang, "notProvided")}
              </p>
            )}
          </div>
        </section>

        {/* Trust & Documents */}
        <section
          id="trust"
          className="border-b border-border px-4 py-8 sm:px-8"
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-3">
            <h2 className="text-lg font-semibold">
              {t(lang, "trustDocuments")}
            </h2>
            <dl className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">
                  {t(lang, "reraNumber")}
                </dt>
                <dd>
                  {project.rera_number ?? t(lang, "notProvided")}
                  {project.rera_authority ? ` (${project.rera_authority})` : ""}
                  {project.rera_url ? (
                    <>
                      {" "}
                      ·{" "}
                      <a
                        href={project.rera_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        Official link
                      </a>
                    </>
                  ) : null}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">
                  {t(lang, "possession")}
                </dt>
                <dd>{project.possession_info ?? t(lang, "notProvided")}</dd>
              </div>
            </dl>
            {documents.length > 0 ? (
              <ul className="flex flex-col gap-1 text-sm">
                {documents.map((d) => (
                  <li key={d.id}>
                    <a
                      href={d.url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      {d.title}
                    </a>
                    {d.verified_at ? (
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        · {t(lang, "verifiedOn")}{" "}
                        {new Date(d.verified_at).toLocaleDateString("en-IN")}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>

        {/* Cost & EMI calculator */}
        <section id="cost" className="border-b border-border px-4 py-8 sm:px-8">
          <div className="mx-auto flex max-w-5xl flex-col gap-4">
            <h2 className="text-lg font-semibold">
              {t(lang, "costEmiCalculator")}
            </h2>
            {examplePlot ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Example based on plot {examplePlot.plot_number}.
                </p>
                <EmiCalculator
                  priceTotal={examplePlot.price_total}
                  lang={lang}
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t(lang, "contactSalesTeam")}.
              </p>
            )}
          </div>
        </section>

        {/* FAQ */}
        {langFaqs.length > 0 ? (
          <section
            id="faq"
            className="border-b border-border px-4 py-8 sm:px-8"
          >
            <div className="mx-auto flex max-w-5xl flex-col gap-3">
              <h2 className="text-lg font-semibold">{t(lang, "faq")}</h2>
              <dl className="flex flex-col gap-3 text-sm">
                {langFaqs.map((f) => (
                  <div key={f.id}>
                    <dt className="font-medium">{f.q}</dt>
                    <dd className="text-muted-foreground">{f.a}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        ) : null}

        {/* Contact / Site visit */}
        <section
          id="site-visit"
          className="border-b border-border px-4 py-8 sm:px-8"
        >
          <div
            id="contact"
            className="mx-auto flex max-w-5xl flex-col gap-6 sm:flex-row"
          >
            <div className="flex-1">
              <h2 className="mb-2 text-lg font-semibold">
                {t(lang, "contact")}
              </h2>
              <p className="text-sm">{org.name}</p>
              {org.contact.phone ? (
                <p className="text-sm">{org.contact.phone}</p>
              ) : null}
              {org.contact.email ? (
                <p className="text-sm">{org.contact.email}</p>
              ) : null}
            </div>
            <div className="flex-1">
              <h2 className="mb-2 text-lg font-semibold">
                {t(lang, "bookSiteVisit")}
              </h2>
              <LeadForm
                slug={projectSlug}
                lang={lang}
                source="site_visit"
                withVisitFields
                ref={shareRef}
              />
            </div>
          </div>
        </section>

        <footer className="px-4 py-6 text-center text-xs">
          <p>
            © {new Date().getFullYear()} {org.name}
          </p>
          {org.powered_by_visible ? (
            <p className="mt-1 text-muted-foreground">Powered by {org.name}</p>
          ) : null}
        </footer>
      </main>

      <StickyActionBar
        phone={org.contact.phone}
        whatsapp={org.contact.whatsapp}
        lang={lang}
      />
    </>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="tabular font-medium">{children}</p>
    </div>
  );
}
