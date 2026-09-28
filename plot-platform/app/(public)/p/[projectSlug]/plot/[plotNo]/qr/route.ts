import { notFound } from "next/navigation";

import { getPublicSiteData } from "@/lib/data/public-site";
import { qrCodeSvg } from "@/lib/qr/generate";

/** Per-plot QR code (§13), for site boards and stakes. */
export async function GET(
  request: Request,
  { params }: RouteContext<"/p/[projectSlug]/plot/[plotNo]/qr">,
) {
  const { projectSlug, plotNo } = await params;
  const result = await getPublicSiteData(projectSlug);
  if (!result.ok || !result.data.plots.some((p) => p.plot_number === plotNo))
    notFound();

  const url = new URL(
    `/p/${projectSlug}/plot/${plotNo}`,
    request.url,
  ).toString();
  const svg = await qrCodeSvg(url);
  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": "public, max-age=3600",
    },
  });
}
