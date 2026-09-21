import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircle, ArrowDownLeft, ArrowUpRight, Settings2 } from "lucide-react";
import { readSession } from "@/server/auth";
import { getUserOrganizations } from "@/server/organization";
import { withOrgTransaction } from "@/server/db";
import { getMetaConnectionStatus } from "@/server/meta/status";

interface RealConnection {
  businessName: string | null;
  displayPhoneNumber: string | null;
  connectionStatus: string;
  qualityRating: string | null;
  messagingLimitTier: string | null;
  isCoexistence: boolean;
}

interface RecentMessage {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  status: string;
  content: { body?: string };
}

async function loadRealConnection(
  organizationId: string,
  userId: string
): Promise<{ connection: RealConnection | null; messages: RecentMessage[] }> {
  return withOrgTransaction(organizationId, userId, async (client) => {
    const phoneResult = await client.query<{
      display_phone_number: string | null;
      status: string;
      quality_rating: string | null;
      messaging_limit_tier: string | null;
      is_coexistence: boolean;
      verified_name: string | null;
    }>(
      `SELECT display_phone_number, status, quality_rating, messaging_limit_tier, is_coexistence, verified_name
       FROM whatsapp_phone_numbers WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [organizationId]
    );
    const phone = phoneResult.rows[0];
    if (!phone) return { connection: null, messages: [] };

    const messagesResult = await client.query<{ id: string; direction: "INBOUND" | "OUTBOUND"; status: string; content: unknown }>(
      `SELECT id, direction, status, content FROM messages WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [organizationId]
    );

    return {
      connection: {
        businessName: phone.verified_name,
        displayPhoneNumber: phone.display_phone_number,
        connectionStatus: phone.status,
        qualityRating: phone.quality_rating,
        messagingLimitTier: phone.messaging_limit_tier,
        isCoexistence: phone.is_coexistence,
      },
      messages: messagesResult.rows.map((m) => ({
        id: m.id,
        direction: m.direction,
        status: m.status,
        content: (m.content ?? {}) as { body?: string },
      })),
    };
  });
}

export default async function WhatsappPage() {
  const session = await readSession();
  if (!session) redirect("/login");

  const organizations = await getUserOrganizations(session.userId);
  const currentOrg = organizations[0];
  if (!currentOrg) redirect("/register");

  const { connection, messages } = await loadRealConnection(currentOrg.organizationId, session.userId);
  const platformStatus = getMetaConnectionStatus();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">WhatsApp</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          {connection
            ? "This is real data stored by this platform."
            : "No WhatsApp number connected yet."}
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-ink-200 bg-white px-4 py-3.5 text-sm">
        <Settings2 className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" strokeWidth={2} />
        <div>
          <p className="font-medium text-ink-800">Platform Meta configuration</p>
          {platformStatus.mockMode ? (
            <p className="text-ink-500">Mock mode — no Meta app credentials are needed yet.</p>
          ) : platformStatus.configured ? (
            <p className="text-brand-700">Configured (Graph API {platformStatus.graphApiVersion}).</p>
          ) : (
            <p className="text-amber-700">
              Missing: {platformStatus.missingVars.join(", ")}. See docs/environment.md.
            </p>
          )}
        </div>
      </div>

      {!connection ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-ink-200 bg-white px-6 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
            <MessageCircle className="h-5 w-5" strokeWidth={2} />
          </span>
          <p className="text-sm text-ink-500">No WhatsApp number connected.</p>
          <Link href="/dashboard/whatsapp/connect" className="btn-primary">
            Connect WhatsApp
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="card p-5">
              <p className="text-xs uppercase tracking-wide text-ink-400">Business</p>
              <p className="mt-1 font-semibold text-ink-900">{connection.businessName ?? "—"}</p>
              <p className="text-sm text-ink-500">{connection.displayPhoneNumber}</p>
            </div>
            <div className="card p-5">
              <p className="text-xs uppercase tracking-wide text-ink-400">Status</p>
              <p className="mt-1 inline-flex items-center gap-1.5 font-semibold text-brand-700">
                <span className="h-2 w-2 rounded-full bg-brand-500" /> {connection.connectionStatus}
              </p>
              <p className="text-sm text-ink-500">
                Quality: {connection.qualityRating ?? "—"} · Tier: {connection.messagingLimitTier ?? "—"}
                {connection.isCoexistence ? " · Coexistence" : ""}
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-ink-700">Recent messages</h2>
            {messages.length === 0 ? (
              <p className="mt-3 text-sm text-ink-500">No messages yet.</p>
            ) : (
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
                    <span className="flex-1 text-ink-800">{m.content.body ?? "(non-text message)"}</span>
                    <span className="shrink-0 text-xs text-ink-400">{m.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
