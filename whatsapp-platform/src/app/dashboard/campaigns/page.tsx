import Link from "next/link";
import { redirect } from "next/navigation";
import { Megaphone } from "lucide-react";
import { readSession } from "@/server/auth";
import { getUserOrganizations } from "@/server/organization";
import { withOrgTransaction } from "@/server/db";
import { createCampaign } from "@/server/actions/campaign-actions";

interface CampaignRow {
  id: string;
  name: string;
  status: string;
  template_name: string | null;
  recipient_count: string;
}

interface TemplateOption {
  id: string;
  name: string;
  status: string;
}

async function loadPageData(organizationId: string, userId: string) {
  return withOrgTransaction(organizationId, userId, async (client) => {
    const campaigns = await client.query<CampaignRow>(
      `SELECT c.id, c.name, c.status, t.name AS template_name, count(cr.id) AS recipient_count
       FROM campaigns c
       LEFT JOIN message_templates t ON t.id = c.template_id
       LEFT JOIN campaign_recipients cr ON cr.campaign_id = c.id
       WHERE c.organization_id = $1
       GROUP BY c.id, t.name
       ORDER BY c.created_at DESC`,
      [organizationId]
    );
    const templates = await client.query<TemplateOption>(
      "SELECT id, name, status FROM message_templates WHERE organization_id = $1 ORDER BY name",
      [organizationId]
    );
    return { campaigns: campaigns.rows, templates: templates.rows };
  });
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-ink-100 text-ink-700",
  RUNNING: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-brand-100 text-brand-800",
  FAILED: "bg-red-100 text-red-700",
};

export default async function CampaignsPage() {
  const session = await readSession();
  if (!session) redirect("/login");

  const organizations = await getUserOrganizations(session.userId);
  const currentOrg = organizations[0];
  if (!currentOrg) redirect("/register");

  const { campaigns, templates } = await loadPageData(currentOrg.organizationId, session.userId);

  async function createAction(formData: FormData) {
    "use server";
    await createCampaign({
      organizationId: currentOrg!.organizationId,
      name: formData.get("name"),
      templateId: formData.get("templateId"),
      audienceTag: formData.get("audienceTag") || undefined,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Campaigns</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Scheduling and CSV-based audiences ship in a later phase. Every campaign passes the
          Compliance Guardian pre-flight check before it can launch.
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="card p-4 text-sm text-ink-600">
          You need at least one template before creating a campaign.{" "}
          <Link href="/dashboard/templates" className="font-medium text-brand-700 hover:underline">
            Create one
          </Link>
          .
        </div>
      ) : (
        <form action={createAction} className="card flex flex-wrap items-end gap-3 p-4">
          <div className="flex-1 basis-40">
            <label className="mb-1 block text-xs font-medium text-ink-600">Campaign name</label>
            <input name="name" required className="input-field" />
          </div>
          <div className="flex-1 basis-40">
            <label className="mb-1 block text-xs font-medium text-ink-600">Template</label>
            <select name="templateId" required className="input-field">
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.status})
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 basis-40">
            <label className="mb-1 block text-xs font-medium text-ink-600">Audience tag (optional)</label>
            <input name="audienceTag" placeholder="Leave blank for all contacts" className="input-field" />
          </div>
          <button type="submit" className="btn-primary">
            Create campaign
          </button>
        </form>
      )}

      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-ink-200 bg-white px-6 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
            <Megaphone className="h-5 w-5" strokeWidth={2} />
          </span>
          <p className="text-sm text-ink-500">No campaigns yet.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Template</th>
                <th className="px-4 py-3">Recipients</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-t border-ink-100">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/campaigns/${c.id}`} className="font-medium text-brand-700 hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-500">{c.template_name ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-500">{c.recipient_count}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[c.status] ?? ""}`}>
                      {c.status}
                    </span>
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
