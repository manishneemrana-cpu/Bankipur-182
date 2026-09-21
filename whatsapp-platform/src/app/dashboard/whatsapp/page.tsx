import { redirect } from "next/navigation";
import { MessageCircle, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { readSession } from "@/server/auth";
import { getUserOrganizations } from "@/server/organization";
import { getMockRecentMessages, getMockWhatsappConnection, isMockModeEnabled } from "@/server/mock/meta";

export default async function WhatsappPage() {
  const session = await readSession();
  if (!session) redirect("/login");

  const organizations = await getUserOrganizations(session.userId);
  const currentOrg = organizations[0];
  if (!currentOrg) redirect("/register");

  const connection = getMockWhatsappConnection(currentOrg.organizationId);
  const messages = getMockRecentMessages(currentOrg.organizationId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">WhatsApp</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Connecting a real WhatsApp Business number via Meta&apos;s Embedded Signup ships in
          Phase 5. What&apos;s shown below is{" "}
          {isMockModeEnabled() ? "simulated demo data" : "empty because nothing real is connected yet"}.
        </p>
      </div>

      {!connection ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-ink-200 bg-white px-6 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
            <MessageCircle className="h-5 w-5" strokeWidth={2} />
          </span>
          <p className="text-sm text-ink-500">No WhatsApp number connected.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="card p-5">
              <p className="text-xs uppercase tracking-wide text-ink-400">Business</p>
              <p className="mt-1 font-semibold text-ink-900">{connection.businessName}</p>
              <p className="text-sm text-ink-500">{connection.displayPhoneNumber}</p>
            </div>
            <div className="card p-5">
              <p className="text-xs uppercase tracking-wide text-ink-400">Status</p>
              <p className="mt-1 inline-flex items-center gap-1.5 font-semibold text-brand-700">
                <span className="h-2 w-2 rounded-full bg-brand-500" /> {connection.connectionStatus}
              </p>
              <p className="text-sm text-ink-500">
                Quality: {connection.qualityRating} · Tier: {connection.messagingLimitTier}
                {connection.isCoexistence ? " · Coexistence" : ""}
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ink-700">Recent messages</h2>
            <ul className="mt-3 flex flex-col gap-2">
              {messages.map((m) => (
                <li key={m.id} className="card flex items-start gap-3 p-3.5 text-sm">
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                      m.direction === "INBOUND" ? "bg-brand-100 text-brand-700" : "bg-ink-100 text-ink-600"
                    }`}
                  >
                    {m.direction === "INBOUND" ? (
                      <ArrowDownLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
                    ) : (
                      <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.25} />
                    )}
                  </span>
                  <span className="flex-1 text-ink-800">{m.body}</span>
                  <span className="shrink-0 text-xs text-ink-400">{m.status}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
