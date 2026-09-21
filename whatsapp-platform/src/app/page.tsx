import Link from "next/link";
import { ShieldCheck, MessagesSquare, Gauge, Users } from "lucide-react";
import { getEnv } from "@/server/env";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";

const FEATURES = [
  {
    icon: MessagesSquare,
    title: "Official WhatsApp Cloud API",
    description:
      "Every client connects their own WhatsApp Business number through Meta's official Embedded Signup — never a shared or pooled account.",
  },
  {
    icon: ShieldCheck,
    title: "Compliance Guardian",
    description:
      "Live quality rating and messaging-limit tracking that keeps clients inside Meta's real rules, so they can scale up safely.",
  },
  {
    icon: Users,
    title: "Built for resale",
    description:
      "White-label branding, role-based team access, and a multi-tenant foundation designed for agencies and resellers from day one.",
  },
  {
    icon: Gauge,
    title: "Real-time inbox & CRM",
    description:
      "A shared team inbox, contact management, and a real-estate-ready lead pipeline, all in one dashboard.",
  },
];

export default function HomePage() {
  const env = getEnv();

  return (
    <>
      <PublicHeader brandName={env.PLATFORM_BRAND_NAME} />

      <main>
        <section className="border-b border-ink-100 bg-gradient-to-b from-brand-50 to-white">
          <div className="mx-auto max-w-4xl px-6 py-20 text-center sm:py-28">
            <span className="inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-800">
              White-label WhatsApp Business Platform
            </span>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-ink-900 sm:text-5xl">
              {env.PLATFORM_BRAND_NAME}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-600">
              Sell and run WhatsApp Business messaging under your own brand — official Cloud API,
              real-time inbox, CRM, and a compliance layer that keeps clients within Meta&apos;s
              rules, not around them.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <Link href="/register" className="btn-primary">
                Get started
              </Link>
              <Link href="/login" className="btn-secondary">
                Log in
              </Link>
            </div>
          </div>
        </section>

        {env.MOCK_META && (
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-center text-sm text-amber-900">
            Demo/mock mode is on — no real WhatsApp message can be sent while this is active.
          </div>
        )}

        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="card p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                  <feature.icon className="h-5 w-5" strokeWidth={2} />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-ink-900">{feature.title}</h3>
                <p className="mt-1.5 text-sm text-ink-500">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-ink-100 bg-white">
          <div className="mx-auto max-w-4xl px-6 py-16 text-center">
            <h2 className="text-2xl font-semibold text-ink-900">
              Building in phases, verified at every step
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-ink-500">
              This platform ships one phase at a time — architecture and tenant isolation first,
              then the dashboard, then Meta integration, then billing — with real tests at every
              stage, not just a working build.
            </p>
          </div>
        </section>
      </main>

      <PublicFooter brandName={env.PLATFORM_BRAND_NAME} />
    </>
  );
}
