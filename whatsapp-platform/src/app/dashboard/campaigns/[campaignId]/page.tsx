import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck, ShieldAlert } from "lucide-react";
import { readSession } from "@/server/auth";
import { getUserOrganizations } from "@/server/organization";
import { withOrgTransaction } from "@/server/db";
import { runCampaignPreflight } from "@/server/compliance";
import { launchCampaign } from "@/server/actions/campaign-actions";

interface RecipientRow {
  id: string;
  status: string;
  skip_reason: string | null;
  phone_e164: string;
  name: string | null;
}

async function loadCampaign(organizationId: string, userId: string, campaignId: string) {
  return withOrgTransaction(organizationId, userId, async (client) => {
    const campaign = await client.query<{ name: string; status: string; template_name: string | null }>(
      `SELECT c.name, c.status, t.name AS template_name
       FROM campaigns c LEFT JOIN message_templates t ON t.id = c.template_id
       WHERE c.organization_id = $1 AND c.id = $2`,
      [organizationId, campaignId]
    );
    if (!campaign.rows[0]) return null;

    const recipients = await client.query<RecipientRow>(
      `SELECT cr.id, cr.status, cr.skip_reason, ct.phone_e164, ct.name
       FROM campaign_recipients cr JOIN contacts ct ON ct.id = cr.contact_id
       WHERE cr.organization_id = $1 AND cr.campaign_id = $2
       ORDER BY cr.created_at`,
      [organizationId, campaignId]
    );

    return { ...campaign.rows[0], recipients: recipients.rows };
  });
}

const RECIPIENT_STATUS_STYLES: Record<string, string> = {
  QUEUED: "bg-ink-100 text-ink-600",
  SENT: "bg-brand-100 text-brand-800",
  FAILED: "bg-red-100 text-red-700",
  SKIPPED: "bg-amber-100 text-amber-800",
};

export default async function CampaignDetailPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const session = await readSession();
  if (!session) redirect("/login");

  const organizations = await getUserOrganizations(session.userId);
  const currentOrg = organizations[0];
  if (!currentOrg) redirect("/register");

  const { campaignId } = await params;
  const campaign = await loadCampaign(currentOrg.organizationId, session.userId, campaignId);
  if (!campaign) notFound();

  const preflight =
    campaign.status === "DRAFT" ? await runCampaignPreflight(currentOrg.organizationId, session.userId, campaignId) : null;

  async function launchAction() {
    "use server";
    await launchCampaign({ organizationId: currentOrg!.organizationId, campaignId });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/campaigns" className="text-ink-400 hover:text-ink-600">
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-ink-900">{campaign.name}</h1>
          <p className="text-sm text-ink-500">Template: {campaign.template_name ?? "—"} · Status: {campaign.status}</p>
        </div>
      </div>

      {preflight && (
        <div className="card flex flex-col gap-3 p-5">
          <div className="flex items-center gap-2">
            {preflight.canLaunch ? (
              <ShieldCheck className="h-5 w-5 text-brand-600" strokeWidth={2} />
            ) : (
              <ShieldAlert className="h-5 w-5 text-amber-600" strokeWidth={2} />
            )}
            <h2 className="text-sm font-semibold text-ink-900">Compliance Guardian pre-flight</h2>
          </div>
          <ul className="text-sm text-ink-600">
            <li>Total recipients: {preflight.totalRecipients}</li>
            <li>Will be sent to: {preflight.eligibleCount}</li>
            {preflight.suppressedCount > 0 && <li>Suppressed (skipped): {preflight.suppressedCount}</li>}
            {preflight.notOptedInCount > 0 && <li>No marketing opt-in (skipped): {preflight.notOptedInCount}</li>}
          </ul>
          {preflight.reasons.length > 0 && (
            <ul className="list-inside list-disc text-sm text-amber-700">
              {preflight.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
          {preflight.canLaunch ? (
            <form action={launchAction}>
              <button type="submit" className="btn-primary self-start">
                Launch campaign
              </button>
            </form>
          ) : (
            <p className="text-sm text-ink-500">Fix the issues above before this campaign can launch.</p>
          )}
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-ink-700">Recipients</h2>
        <div className="card mt-3 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Reason</th>
              </tr>
            </thead>
            <tbody>
              {campaign.recipients.map((r) => (
                <tr key={r.id} className="border-t border-ink-100">
                  <td className="px-4 py-3 font-medium text-ink-900">{r.name ?? r.phone_e164}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${RECIPIENT_STATUS_STYLES[r.status]}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-500">{r.skip_reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
