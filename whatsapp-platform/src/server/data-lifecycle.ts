import "server-only";
import { withOrgTransaction } from "@/server/db";

/**
 * Builds a full export of an organization's customer data and records the
 * request as READY immediately — computed on demand from the live tables
 * rather than as an async job writing to file storage (no file storage
 * integration exists yet; see docs/decisions.md). Fine for the data volumes
 * a real-estate WhatsApp tenant has today; a large tenant would need this
 * moved to a background job before it's viable.
 */
export async function exportOrganizationData(organizationId: string, requestedByUserId: string): Promise<object> {
  return withOrgTransaction(organizationId, requestedByUserId, async (client) => {
    const [contacts, leads, conversations, messages, templates] = await Promise.all([
      client.query("SELECT * FROM contacts ORDER BY created_at"),
      client.query("SELECT * FROM leads ORDER BY created_at"),
      client.query("SELECT * FROM conversations ORDER BY created_at"),
      client.query("SELECT * FROM messages ORDER BY created_at"),
      client.query("SELECT * FROM message_templates ORDER BY created_at"),
    ]);

    await client.query(
      `INSERT INTO data_export_requests (organization_id, requested_by, status, completed_at)
       VALUES ($1, $2, 'READY', now())`,
      [organizationId, requestedByUserId]
    );

    return {
      exportedAt: new Date().toISOString(),
      organizationId,
      contacts: contacts.rows,
      leads: leads.rows,
      conversations: conversations.rows,
      messages: messages.rows,
      templates: templates.rows,
    };
  });
}

/**
 * Deletes one contact and everything that legitimately cascades from it
 * (conversations, messages, campaign_recipients — all ON DELETE CASCADE).
 * `leads.contact_id` and `send_jobs.contact_id` have no cascade (a lead or a
 * queued send is not "the contact's data" in the same sense), so those are
 * detached/removed first rather than left to fail the delete with an FK
 * violation. Recorded as a completed deletion_requests row, not a pending
 * one — this runs synchronously, there's no queue to hand it to.
 */
export async function deleteContactData(organizationId: string, requestedByUserId: string, contactId: string): Promise<void> {
  await withOrgTransaction(organizationId, requestedByUserId, async (client) => {
    await client.query("DELETE FROM send_jobs WHERE organization_id = $1 AND contact_id = $2", [organizationId, contactId]);
    await client.query("UPDATE leads SET contact_id = NULL WHERE organization_id = $1 AND contact_id = $2", [
      organizationId,
      contactId,
    ]);
    const deleted = await client.query("DELETE FROM contacts WHERE organization_id = $1 AND id = $2 RETURNING id", [
      organizationId,
      contactId,
    ]);
    if (deleted.rows.length === 0) {
      throw new Error("Contact not found");
    }

    await client.query(
      `INSERT INTO deletion_requests (organization_id, requested_by, scope, target_id, status, completed_at)
       VALUES ($1, $2, 'CONTACT', $3, 'DONE', now())`,
      [organizationId, requestedByUserId, contactId]
    );
  });
}

/**
 * Flags the whole organization for deletion. Deliberately NOT executed
 * automatically — destroying an entire tenant's data is not a self-service
 * action a dashboard button should be able to trigger instantly. A platform
 * admin reviews and actions this manually (see docs/compliance-guide.md).
 */
export async function requestOrganizationDeletion(organizationId: string, requestedByUserId: string): Promise<void> {
  await withOrgTransaction(organizationId, requestedByUserId, (client) =>
    client.query(
      `INSERT INTO deletion_requests (organization_id, requested_by, scope, status)
       VALUES ($1, $2, 'ORGANIZATION', 'PENDING')`,
      [organizationId, requestedByUserId]
    )
  );
}
