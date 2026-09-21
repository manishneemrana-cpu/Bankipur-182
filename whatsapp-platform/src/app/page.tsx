import { getEnv } from "@/server/env";

export default function HomePage() {
  const env = getEnv();
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold">{env.PLATFORM_BRAND_NAME}</h1>
      <p className="text-slate-600">
        White-label WhatsApp Business Platform — Phase 1 scaffold (architecture, database, auth,
        tenant isolation). Meta/WhatsApp integration has not been built yet.
      </p>
      {env.MOCK_META && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          MOCK_META is on: no real Meta/WhatsApp API calls will ever be made while this is set.
        </div>
      )}
      <div className="flex gap-3">
        <a href="/dashboard" className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white">
          Dashboard
        </a>
        <a href="/admin" className="rounded-md border border-slate-300 px-4 py-2 text-sm">
          Admin
        </a>
      </div>
    </main>
  );
}
