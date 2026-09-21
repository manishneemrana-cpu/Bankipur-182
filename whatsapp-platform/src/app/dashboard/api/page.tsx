import { redirect } from "next/navigation";
import { Code2 } from "lucide-react";
import { readSession } from "@/server/auth";
import { getUserOrganizations } from "@/server/organization";
import { withOrgTransaction } from "@/server/db";
import { revokeApiKeyAction } from "@/server/actions/api-key-actions";
import { CreateApiKeyForm } from "./create-key-form";

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  revoked_at: string | null;
  last_used_at: string | null;
}

async function listApiKeys(organizationId: string, userId: string): Promise<ApiKeyRow[]> {
  return withOrgTransaction(organizationId, userId, async (client) => {
    const result = await client.query<ApiKeyRow>(
      "SELECT id, name, key_prefix, scopes, revoked_at, last_used_at FROM api_keys WHERE organization_id = $1 ORDER BY created_at DESC",
      [organizationId]
    );
    return result.rows;
  });
}

export default async function ApiPage() {
  const session = await readSession();
  if (!session) redirect("/login");

  const organizations = await getUserOrganizations(session.userId);
  const currentOrg = organizations[0];
  if (!currentOrg) redirect("/register");

  const apiKeys = await listApiKeys(currentOrg.organizationId, session.userId);

  async function revokeAction(formData: FormData) {
    "use server";
    await revokeApiKeyAction({ organizationId: currentOrg!.organizationId, apiKeyId: formData.get("apiKeyId") });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">API</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Used by the n8n integration (<code className="rounded bg-ink-100 px-1">POST /api/integrations/n8n/webhook</code>
          ) and the public REST API under <code className="rounded bg-ink-100 px-1">/api/v1/...</code> — both take{" "}
          <code className="rounded bg-ink-100 px-1">Authorization: Bearer &lt;key&gt;</code>. See{" "}
          <code className="rounded bg-ink-100 px-1">docs/api.md</code> for the full reference.
        </p>
      </div>

      <CreateApiKeyForm organizationId={currentOrg.organizationId} />

      {apiKeys.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-ink-200 bg-white px-6 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
            <Code2 className="h-5 w-5" strokeWidth={2} />
          </span>
          <p className="text-sm text-ink-500">No API keys yet.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Prefix</th>
                <th className="px-4 py-3">Scopes</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((k) => (
                <tr key={k.id} className="border-t border-ink-100">
                  <td className="px-4 py-3 font-medium text-ink-900">{k.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-500">{k.key_prefix}…</td>
                  <td className="px-4 py-3 text-ink-500">{k.scopes.join(", ")}</td>
                  <td className="px-4 py-3">
                    {k.revoked_at ? (
                      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">Revoked</span>
                    ) : (
                      <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-800">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!k.revoked_at && (
                      <form action={revokeAction}>
                        <input type="hidden" name="apiKeyId" value={k.id} />
                        <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
                          Revoke
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
