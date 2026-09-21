import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { readSession } from "@/server/auth";
import { getUserOrganizations } from "@/server/organization";
import { withOrgTransaction } from "@/server/db";
import { sendTextReply, sendTemplateReply } from "@/server/actions/messaging-actions";

interface ThreadData {
  contactName: string | null;
  phoneE164: string;
  windowOpen: boolean;
  messages: Array<{ id: string; direction: "INBOUND" | "OUTBOUND"; status: string; body: string | null }>;
  approvedTemplates: Array<{ id: string; name: string }>;
}

async function loadThread(organizationId: string, userId: string, conversationId: string): Promise<ThreadData | null> {
  return withOrgTransaction(organizationId, userId, async (client) => {
    const conversation = await client.query<{ contact_name: string | null; phone_e164: string; last_inbound_at: Date | null }>(
      `SELECT ct.name AS contact_name, ct.phone_e164, c.last_inbound_at
       FROM conversations c JOIN contacts ct ON ct.id = c.contact_id
       WHERE c.organization_id = $1 AND c.id = $2`,
      [organizationId, conversationId]
    );
    const row = conversation.rows[0];
    if (!row) return null;

    const messages = await client.query<{ id: string; direction: "INBOUND" | "OUTBOUND"; status: string; content: unknown }>(
      "SELECT id, direction, status, content FROM messages WHERE organization_id = $1 AND conversation_id = $2 ORDER BY created_at ASC LIMIT 200",
      [organizationId, conversationId]
    );

    const templates = await client.query<{ id: string; name: string }>(
      "SELECT id, name FROM message_templates WHERE organization_id = $1 AND status = 'APPROVED' ORDER BY name",
      [organizationId]
    );

    const windowOpen =
      row.last_inbound_at !== null && Date.now() - new Date(row.last_inbound_at).getTime() <= 24 * 60 * 60 * 1000;

    return {
      contactName: row.contact_name,
      phoneE164: row.phone_e164,
      windowOpen,
      messages: messages.rows.map((m) => ({
        id: m.id,
        direction: m.direction,
        status: m.status,
        body: (m.content as { body?: string } | null)?.body ?? null,
      })),
      approvedTemplates: templates.rows,
    };
  });
}

export default async function ConversationThreadPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const session = await readSession();
  if (!session) redirect("/login");

  const organizations = await getUserOrganizations(session.userId);
  const currentOrg = organizations[0];
  if (!currentOrg) redirect("/register");

  const { conversationId } = await params;
  const thread = await loadThread(currentOrg.organizationId, session.userId, conversationId);
  if (!thread) notFound();

  async function replyAction(formData: FormData) {
    "use server";
    await sendTextReply({
      organizationId: currentOrg!.organizationId,
      conversationId,
      body: formData.get("body"),
    });
  }

  async function templateReplyAction(formData: FormData) {
    "use server";
    await sendTemplateReply({
      organizationId: currentOrg!.organizationId,
      conversationId,
      templateId: formData.get("templateId"),
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/inbox" className="text-ink-400 hover:text-ink-600">
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-ink-900">{thread.contactName ?? thread.phoneE164}</h1>
          <p className="text-sm text-ink-500">{thread.phoneE164}</p>
        </div>
      </div>

      <div className="card flex flex-col gap-3 p-4">
        {thread.messages.length === 0 ? (
          <p className="text-sm text-ink-500">No messages yet.</p>
        ) : (
          thread.messages.map((m) => (
            <div key={m.id} className={`flex ${m.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}>
              <div
                className={`flex max-w-[80%] items-start gap-2 rounded-lg px-3 py-2 text-sm ${
                  m.direction === "OUTBOUND" ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-800"
                }`}
              >
                {m.direction === "INBOUND" ? (
                  <ArrowDownLeft className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
                ) : (
                  <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={2.25} />
                )}
                <span>{m.body ?? "(non-text message)"}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {thread.windowOpen ? (
        <form action={replyAction} className="flex gap-2">
          <input name="body" placeholder="Type a reply…" required className="input-field flex-1" />
          <button type="submit" className="btn-primary">
            Send
          </button>
        </form>
      ) : (
        <div className="card flex flex-col gap-3 p-4">
          <p className="text-sm text-amber-700">
            The 24-hour reply window is closed — send an approved template instead.
          </p>
          {thread.approvedTemplates.length === 0 ? (
            <p className="text-sm text-ink-500">
              No approved templates yet.{" "}
              <Link href="/dashboard/templates" className="font-medium text-brand-700 hover:underline">
                Create one
              </Link>
              .
            </p>
          ) : (
            <form action={templateReplyAction} className="flex gap-2">
              <select name="templateId" required className="input-field flex-1">
                {thread.approvedTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn-primary">
                Send template
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
