import { PRODUCT_NAME } from "@/lib/constants";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 px-4 py-12">
      <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
        Phase 0 · Foundation
      </p>
      <h1 className="text-3xl font-semibold tracking-tight break-words">
        {PRODUCT_NAME}
      </h1>
      <p className="text-muted-foreground">
        Upload your plot layout PDF. Get a live, branded, mobile-first project
        website with an interactive plot map, real-time availability, AI sales
        assistant and lead capture — on one WhatsApp-shareable link.
      </p>
      <p className="text-sm">
        Health check:{" "}
        <a className="underline underline-offset-4" href="/api/health">
          /api/health
        </a>
      </p>
    </main>
  );
}
