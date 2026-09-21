import { redirect } from "next/navigation";
import { MessageCircle, Smartphone, RefreshCw, PlusCircle } from "lucide-react";
import { readSession } from "@/server/auth";
import { getUserOrganizations } from "@/server/organization";
import { isMockModeEnabled } from "@/server/mock/meta";
import { startConnectWhatsapp, completeMockConnectWhatsapp } from "@/server/actions/onboarding-actions";
import type { ConnectionPath } from "@/server/onboarding";

const PATH_LABELS: Record<ConnectionPath, { label: string; icon: typeof Smartphone; description: string }> = {
  EXISTING_APP_NUMBER: {
    label: "Keep using your current WhatsApp number",
    icon: Smartphone,
    description:
      "Coexistence: you keep replying one-to-one from the WhatsApp Business app on your phone, while this platform sends at scale through the same number. Your chat history stays in sync between the app and this dashboard.",
  },
  NEW_NUMBER: {
    label: "Connect a brand-new number",
    icon: PlusCircle,
    description: "A number that has never been used on WhatsApp before, dedicated to this platform only.",
  },
  MIGRATED: {
    label: "Move a number from another provider",
    icon: RefreshCw,
    description: "A number already on WhatsApp's Cloud API through a different provider, moving to this platform.",
  },
};

export default async function ConnectWhatsappPage({
  searchParams,
}: {
  searchParams: Promise<{ sessionId?: string; path?: string }>;
}) {
  const session = await readSession();
  if (!session) redirect("/login");

  const organizations = await getUserOrganizations(session.userId);
  const currentOrg = organizations[0];
  if (!currentOrg) redirect("/register");

  const { sessionId, path } = await searchParams;
  const mockMode = isMockModeEnabled();

  async function startAction(formData: FormData) {
    "use server";
    const connectionPath = formData.get("connectionPath") as string;
    const result = await startConnectWhatsapp({
      organizationId: currentOrg!.organizationId,
      connectionPath,
    });
    if (result.ok && result.sessionId) {
      redirect(`/dashboard/whatsapp/connect?sessionId=${result.sessionId}&path=${connectionPath}`);
    }
  }

  async function completeAction(formData: FormData) {
    "use server";
    await completeMockConnectWhatsapp({
      organizationId: currentOrg!.organizationId,
      sessionId: formData.get("sessionId"),
      connectionPath: formData.get("connectionPath"),
    });
  }

  if (sessionId && path) {
    const pathInfo = PATH_LABELS[path as ConnectionPath];
    return (
      <div className="flex max-w-xl flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Connect WhatsApp</h1>
          <p className="mt-1 text-sm text-ink-500">Step 2 of 2 — review and complete.</p>
        </div>

        <div className="card p-5">
          <p className="text-xs uppercase tracking-wide text-ink-400">You chose</p>
          <p className="mt-1 font-medium text-ink-900">{pathInfo?.label}</p>
          <p className="mt-1 text-sm text-ink-500">{pathInfo?.description}</p>
        </div>

        {mockMode ? (
          <div className="card flex flex-col gap-3 p-5">
            <p className="text-sm text-ink-700">
              Mock mode is on, so this simulates what Meta&apos;s Embedded Signup would do —
              authenticate with Meta, select a business, select a WhatsApp Business Account,
              select a phone number, connect, and verify — without contacting Meta for real.
            </p>
            <form action={completeAction}>
              <input type="hidden" name="sessionId" value={sessionId} />
              <input type="hidden" name="connectionPath" value={path} />
              <button type="submit" className="btn-primary">
                Simulate completing signup
              </button>
            </form>
          </div>
        ) : (
          <div className="card p-5 text-sm text-amber-700">
            Real Embedded Signup (loading Meta&apos;s JS SDK and exchanging the returned code for
            an access token) is not built yet — see docs/embedded-signup.md for why.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Connect WhatsApp</h1>
        <p className="mt-1 text-sm text-ink-500">Step 1 of 2 — how do you want to connect?</p>
      </div>

      <form action={startAction} className="flex flex-col gap-3">
        {(Object.keys(PATH_LABELS) as ConnectionPath[]).map((key) => {
          const info = PATH_LABELS[key];
          return (
            <label key={key} className="card flex cursor-pointer items-start gap-3 p-4 hover:border-brand-300">
              <input type="radio" name="connectionPath" value={key} required className="mt-1" />
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                <info.icon className="h-4 w-4" strokeWidth={2} />
              </span>
              <span>
                <span className="block font-medium text-ink-900">{info.label}</span>
                <span className="block text-sm text-ink-500">{info.description}</span>
              </span>
            </label>
          );
        })}
        <button type="submit" className="btn-primary mt-2 self-start">
          <MessageCircle className="h-4 w-4" strokeWidth={2} />
          Continue
        </button>
      </form>
    </div>
  );
}
