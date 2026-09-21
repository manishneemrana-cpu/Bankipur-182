import { getEnv } from "@/server/env";
import { PublicHeader } from "./public-header";
import { PublicFooter } from "./public-footer";

export function LegalPage({ title }: { title: string }) {
  const env = getEnv();
  return (
    <>
      <PublicHeader brandName={env.PLATFORM_BRAND_NAME} />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Placeholder — this page requires legal review before going live. The legal entity for
          every such document is SitesNSign Prop Tech Pvt. Ltd.
        </div>
      </main>
      <PublicFooter brandName={env.PLATFORM_BRAND_NAME} />
    </>
  );
}
