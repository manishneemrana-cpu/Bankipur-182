import { notFound } from "next/navigation";

import { getPublicSiteData } from "@/lib/data/public-site";
import { qrCodeSvg } from "@/lib/qr/generate";

/** Project QR code (§13): downloadable SVG pointing at the public link. */
export async function GET(
  request: Request,
  { params }: RouteContext<"/p/[projectSlug]/qr">,
) {
  const { projectSlug } = await params;
  const result = await getPublicSiteData(projectSlug);
  if (!result.ok) notFound();

  const url = new URL(`/p/${projectSlug}`, request.url).toString();
  const svg = await qrCodeSvg(url);
  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": "public, max-age=3600",
    },
  });
}
