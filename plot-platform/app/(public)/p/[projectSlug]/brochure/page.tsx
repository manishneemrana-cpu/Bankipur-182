import { notFound } from "next/navigation";

import { getPublicSiteData } from "@/lib/data/public-site";
import { formatIndianCurrency } from "@/lib/format";

import { PrintButton } from "./print-button";

/**
 * Smart brochure (§13): one-click, always-current, clearly timestamped.
 * A plain print-friendly page rather than a generated PDF file — "Print" /
 * "Save as PDF" from the browser produces an identical, honestly-dated PDF
 * without adding a server-side PDF renderer.
 */
export default async function BrochurePage(
  props: PageProps<"/p/[projectSlug]/brochure">,
) {
  const { projectSlug } = await props.params;
  const result = await getPublicSiteData(projectSlug);
  if (!result.ok) notFound();

  const { project, org, plots } = result.data;
  const available = plots.filter((p) => p.status === "AVAILABLE");
  const generatedAt = new Date();

  return (
    <main className="mx-auto max-w-3xl p-8 text-sm print:p-0">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <p className="text-muted-foreground">
            {[project.address, project.city, project.state]
              .filter(Boolean)
              .join(", ")}
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- static per-request SVG, not an optimizable asset */}
        <img
          src={`/p/${projectSlug}/qr`}
          alt="QR code to the live project page"
          width={96}
          height={96}
        />
      </div>
      <p className="mb-6 text-xs text-muted-foreground">
        Generated {generatedAt.toLocaleString("en-IN")} — availability may
        change after this moment; the QR code above always shows the live page.
      </p>

      <h2 className="mb-2 font-semibold">
        Available plots ({available.length})
      </h2>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b text-left">
            <th className="py-1">Plot</th>
            <th className="py-1">Area</th>
            <th className="py-1">Facing</th>
            <th className="py-1">Price</th>
          </tr>
        </thead>
        <tbody>
          {available.map((p) => (
            <tr key={p.id} className="border-b">
              <td className="py-1">{p.plot_number}</td>
              <td className="tabular py-1">
                {p.area_official_value
                  ? `${p.area_official_value} ${p.area_official_unit}`
                  : "Not provided"}
              </td>
              <td className="py-1">{p.facing}</td>
              <td className="tabular py-1">
                {p.price_total
                  ? formatIndianCurrency(p.price_total)
                  : "On request"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-6 text-xs">
        {org.name}
        {org.contact.phone ? ` · ${org.contact.phone}` : ""}
        {org.contact.email ? ` · ${org.contact.email}` : ""}
      </p>

      <PrintButton />
    </main>
  );
}
