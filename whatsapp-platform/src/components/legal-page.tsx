import type { ReactNode } from "react";
import { getEnv } from "@/server/env";
import { PublicHeader } from "./public-header";
import { PublicFooter } from "./public-footer";

export function LegalPage({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated?: string;
  children?: ReactNode;
}) {
  const env = getEnv();
  return (
    <>
      <PublicHeader brandName={env.PLATFORM_BRAND_NAME} />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {lastUpdated && <p className="mt-1 text-sm text-ink-400">Draft last updated: {lastUpdated}</p>}
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Draft — pending legal review.</strong> This is a working draft, not yet reviewed
          or approved by a lawyer, and must not be treated as final or legally binding until it
          is. The legal entity for this document is SitesNSign Prop Tech Pvt. Ltd.
        </div>
        {children ? (
          <div className="prose-legal mt-8 flex flex-col gap-6 text-sm leading-relaxed text-ink-700 [&_h2]:mt-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink-900 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1">
            {children}
          </div>
        ) : (
          <p className="mt-6 text-sm text-ink-500">Content for this page has not been drafted yet.</p>
        )}
      </main>
      <PublicFooter brandName={env.PLATFORM_BRAND_NAME} />
    </>
  );
}
