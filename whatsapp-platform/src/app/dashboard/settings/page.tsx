import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { readSession } from "@/server/auth";
import { getUserOrganizations } from "@/server/organization";
import { hasPermission } from "@/server/permissions";
import { withOrgTransaction } from "@/server/db";
import { DangerZone } from "./danger-zone";

async function hasPendingOrgDeletionRequest(organizationId: string): Promise<boolean> {
  return withOrgTransaction(organizationId, async (client) => {
    const result = await client.query(
      "SELECT 1 FROM deletion_requests WHERE organization_id = $1 AND scope = 'ORGANIZATION' AND status = 'PENDING' LIMIT 1",
      [organizationId]
    );
    return result.rows.length > 0;
  });
}

export default async function SettingsPage() {
  const session = await readSession();
  if (!session) redirect("/login");

  const organizations = await getUserOrganizations(session.userId);
  const currentOrg = organizations[0];
  if (!currentOrg) redirect("/register");

  const canExport = hasPermission(currentOrg.role, [], "manage_billing");
  const alreadyRequestedDeletion = currentOrg.role === "OWNER" ? await hasPendingOrgDeletionRequest(currentOrg.organizationId) : false;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Settings</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          White-label branding (name, logo, colors, favicon) ships in a later phase.
        </p>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink-900">Export your data</h2>
        <p className="mb-3 max-w-2xl text-sm text-ink-500">
          Downloads every contact, lead, conversation, message, and template for this
          organization as a single JSON file.
        </p>
        {canExport ? (
          <a
            href={`/api/dashboard/export?organizationId=${currentOrg.organizationId}`}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <Download className="h-4 w-4" strokeWidth={2} />
            Download export
          </a>
        ) : (
          <p className="text-sm text-ink-500">Only an Owner or Admin can export organization data.</p>
        )}
      </div>

      {currentOrg.role === "OWNER" && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-red-700">Danger zone</h2>
          <DangerZone organizationId={currentOrg.organizationId} alreadyRequested={alreadyRequestedDeletion} />
        </div>
      )}
    </div>
  );
}
