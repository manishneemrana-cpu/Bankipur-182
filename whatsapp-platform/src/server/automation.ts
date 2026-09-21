import "server-only";
import type { PoolClient } from "pg";
import { withOrgTransaction } from "@/server/db";
import { sendTextMessage as sendTextViaMeta } from "@/server/meta/client";
import { isMockModeEnabled } from "@/server/mock/meta";

/**
 * The "ready-made basics" trigger/action set from the brief: keyword
 * auto-reply, welcome message, business-hours away message. The fuller
 * trigger/action catalogue (lead_created, scheduled_time, call_n8n, call_ai,
 * etc.) is deferred — this covers what actually fires today, from an
 * inbound WhatsApp message, since that's the only trigger source that
 * exists (webhook processing).
 *
 * Per the project rule, automation never sends without the tenant having
 * explicitly enabled the rule (the `enabled` column), and every action here
 * is a plain text reply — never a template, never anything requiring a
 * human-in-the-loop decision.
 */

interface AutomationRow {
  id: string;
  trigger_type: string;
  trigger_config: {
    keywords?: string[];
    businessHours?: { start: string; end: string; timezone?: string };
  };
  actions: Array<{ type: string; body?: string }>;
}

function isWithinBusinessHours(hours: { start: string; end: string }): boolean {
  const now = new Date();
  const [startH, startM] = hours.start.split(":").map(Number);
  const [endH, endM] = hours.end.split(":").map(Number);
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const startMinutes = (startH ?? 0) * 60 + (startM ?? 0);
  const endMinutes = (endH ?? 23) * 60 + (endM ?? 59);
  return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
}

function matchesTrigger(automation: AutomationRow, messageBody: string, isNewContact: boolean): boolean {
  switch (automation.trigger_type) {
    case "welcome_message":
      return isNewContact;
    case "keyword_auto_reply": {
      const keywords = automation.trigger_config.keywords ?? [];
      const lower = messageBody.toLowerCase();
      return keywords.some((k) => lower.includes(k.toLowerCase()));
    }
    case "business_hours_away": {
      const hours = automation.trigger_config.businessHours;
      if (!hours) return false;
      return !isWithinBusinessHours(hours);
    }
    default:
      return false;
  }
}

async function executeAction(
  organizationId: string,
  conversationId: string,
  phoneNumberId: string,
  toPhone: string,
  action: { type: string; body?: string },
  client: PoolClient
): Promise<void> {
  if (action.type !== "send_message" || !action.body) return;

  const accessToken = isMockModeEnabled() ? "mock-token" : "";
  const result = await sendTextViaMeta({
    phoneNumberId,
    accessToken,
    to: toPhone,
    body: action.body,
    idempotencyKey: `automation-${conversationId}-${Date.now()}`,
  });

  await client.query(
    `INSERT INTO messages (organization_id, conversation_id, direction, type, content, meta_message_id, status)
     VALUES ($1, $2, 'OUTBOUND', 'text', $3, $4, 'sent')`,
    [organizationId, conversationId, JSON.stringify({ body: action.body, automated: true }), result.metaMessageId]
  );
}

export interface AutomationTriggerContext {
  organizationId: string;
  conversationId: string;
  contactId: string;
  contactPhone: string;
  contactSuppressed: boolean;
  whatsappPhoneNumberId: string;
  phoneNumberId: string;
  messageBody: string;
  isNewContact: boolean;
}

/**
 * Runs every enabled incoming_message automation for an organization against
 * one inbound message. Called from webhook processing, in the same
 * transaction-per-organization pattern as the rest of message handling.
 */
export async function runIncomingMessageAutomations(ctx: AutomationTriggerContext): Promise<void> {
  if (ctx.contactSuppressed) return;

  await withOrgTransaction(ctx.organizationId, async (client) => {
    const automations = await client.query<AutomationRow>(
      `SELECT id, trigger_type, trigger_config, actions FROM automations
       WHERE organization_id = $1 AND enabled = true
         AND trigger_type IN ('welcome_message', 'keyword_auto_reply', 'business_hours_away')`,
      [ctx.organizationId]
    );

    for (const automation of automations.rows) {
      if (!matchesTrigger(automation, ctx.messageBody, ctx.isNewContact)) continue;

      const run = await client.query<{ id: string }>(
        `INSERT INTO automation_runs (organization_id, automation_id, trigger_payload, status)
         VALUES ($1, $2, $3, 'RUNNING') RETURNING id`,
        [ctx.organizationId, automation.id, JSON.stringify({ conversationId: ctx.conversationId, messageBody: ctx.messageBody })]
      );

      try {
        for (const action of automation.actions) {
          await executeAction(ctx.organizationId, ctx.conversationId, ctx.phoneNumberId, ctx.contactPhone, action, client);
        }
        await client.query("UPDATE automation_runs SET status = 'DONE', finished_at = now() WHERE id = $1", [
          run.rows[0]!.id,
        ]);
      } catch (err) {
        await client.query(
          "UPDATE automation_runs SET status = 'FAILED', error_message = $1, finished_at = now() WHERE id = $2",
          [err instanceof Error ? err.message : String(err), run.rows[0]!.id]
        );
      }
    }
  });
}
