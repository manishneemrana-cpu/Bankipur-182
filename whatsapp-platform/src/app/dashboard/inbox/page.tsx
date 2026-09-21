import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox as InboxIcon } from "lucide-react";
import { readSession } from "@/server/auth";
import { getUserOrganizations } from "@/server/organization";
import { withOrgTransaction } from "@/server/db";

interface ConversationRow {
  id: string;
  status: string;
  contact_name: string | null;
  phone_e164: string;
  last_message_body: string | null;
  last_message_at: string | null;
}

async function listConversations(organizationId: string, userId: string): Promise<ConversationRow[]> {
  return withOrgTransaction(organizationId, userId, async (client) => {
    const result = await client.query<ConversationRow>(
      `SELECT c.id, c.status, ct.name AS contact_name, ct.phone_e164,
              m.content->>'body' AS last_message_body, m.created_at AS last_message_at
       FROM conversations c
       JOIN contacts ct ON ct.id = c.contact_id
       LEFT JOIN LATERAL (
         SELECT content, created_at FROM messages
         WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1
       ) m ON true
       WHERE c.organization_id = $1
       ORDER BY COALESCE(m.created_at, c.created_at) DESC
       LIMIT 100`,
      [organizationId]
    );
    return result.rows;
  });
}

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-brand-100 text-brand-800",
  PENDING: "bg-amber-100 text-amber-800",
  FOLLOW_UP: "bg-amber-100 text-amber-800",
  RESOLVED: "bg-ink-100 text-ink-600",
  CLOSED: "bg-ink-100 text-ink-600",
};

export default async function InboxPage() {
  const session = await readSession();
  if (!session) redirect("/login");

  const organizations = await getUserOrganizations(session.userId);
  const currentOrg = organizations[0];
  if (!currentOrg) redirect("/register");

  const conversations = await listConversations(currentOrg.organizationId, session.userId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Inbox</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Filters, internal notes, and agent assignment ship in a later phase.
        </p>
      </div>

      {conversations.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-ink-200 bg-white px-6 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
            <InboxIcon className="h-5 w-5" strokeWidth={2} />
          </span>
          <p className="text-sm text-ink-500">
            No conversations yet. Once a customer messages your connected number, it appears
            here.
          </p>
        </div>
      ) : (
        <ul className="card divide-y divide-ink-100 overflow-hidden">
          {conversations.map((c) => (
            <li key={c.id}>
              <Link href={`/dashboard/inbox/${c.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-ink-50">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink-900">{c.contact_name ?? c.phone_e164}</p>
                  <p className="truncate text-sm text-ink-500">{c.last_message_body ?? "No messages yet"}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[c.status]}`}>
                  {c.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
