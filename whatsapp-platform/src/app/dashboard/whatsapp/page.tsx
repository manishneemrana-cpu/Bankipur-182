import { redirect } from "next/navigation";
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
        <h1 className="text-xl font-semibold">WhatsApp</h1>
        <p className="mt-1 text-sm text-slate-600">
          Connecting a real WhatsApp Business number via Meta&apos;s Embedded Signup ships in
          Phase 5. What&apos;s shown below is {isMockModeEnabled() ? "simulated demo data" : "empty because nothing real is connected yet"}.
        </p>
      </div>

      {!connection ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          No WhatsApp number connected.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Business</p>
              <p className="mt-1 font-medium">{connection.businessName}</p>
              <p className="text-sm text-slate-600">{connection.displayPhoneNumber}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Status</p>
              <p className="mt-1 font-medium">{connection.connectionStatus}</p>
              <p className="text-sm text-slate-600">
                Quality: {connection.qualityRating} · Tier: {connection.messagingLimitTier}
                {connection.isCoexistence ? " · Coexistence" : ""}
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-medium text-slate-700">Recent messages</h2>
            <ul className="mt-2 flex flex-col gap-2">
              {messages.map((m) => (
                <li key={m.id} className="rounded-md border border-slate-200 bg-white p-3 text-sm">
                  <span className="mr-2 rounded bg-slate-100 px-2 py-0.5 text-xs">
                    {m.direction === "INBOUND" ? "In" : "Out"}
                  </span>
                  {m.body}
                  <span className="ml-2 text-xs text-slate-400">{m.status}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
