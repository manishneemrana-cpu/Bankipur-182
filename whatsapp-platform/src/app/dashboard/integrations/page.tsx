import { redirect } from "next/navigation";
import { readSession } from "@/server/auth";
import { getUserOrganizations } from "@/server/organization";
import { listOutboundWebhooks } from "@/server/outbound-webhooks";
import { CreateWebhookForm } from "./create-webhook-form";
import { WebhookRow } from "./webhook-row";

export default async function IntegrationsPage() {
  const session = await readSession();
  if (!session) redirect("/login");

  const organizations = await getUserOrganizations(session.userId);
  const currentOrg = organizations[0];
  if (!currentOrg) redirect("/register");

  const webhooks = await listOutboundWebhooks(currentOrg.organizationId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Integrations</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Outbound webhooks notify your own systems (n8n, a CRM, a custom server) when something
          happens here. Each delivery is HMAC-signed with the webhook&apos;s secret
          (<code className="rounded bg-ink-100 px-1">X-Webhook-Signature</code>, hex-encoded
          HMAC-SHA256 of the raw JSON body) so you can verify it came from us. See{" "}
          <code className="rounded bg-ink-100 px-1">docs/api.md</code> for the payload shape.
          For API keys (inbound access to your data), see the API page.
        </p>
      </div>

      <CreateWebhookForm organizationId={currentOrg.organizationId} />

      {webhooks.length === 0 ? (
        <p className="text-sm text-ink-500">No outbound webhooks yet.</p>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3">URL</th>
                <th className="px-4 py-3">Events</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {webhooks.map((webhook) => (
                <WebhookRow key={webhook.id} organizationId={currentOrg.organizationId} webhook={webhook} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
