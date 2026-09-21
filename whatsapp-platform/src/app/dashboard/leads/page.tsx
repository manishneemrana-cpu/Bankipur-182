import { redirect } from "next/navigation";
import { Target } from "lucide-react";
import { readSession } from "@/server/auth";
import { getUserOrganizations } from "@/server/organization";
import { withOrgTransaction } from "@/server/db";
import { createLead, deleteLead, updateLeadStatus } from "@/server/actions/lead-actions";
import { LeadStatusSelect } from "./status-select";

interface LeadRow {
  id: string;
  name: string;
  phone: string | null;
  property: string | null;
  budget: string | null;
  lead_status: string;
}

async function listLeads(organizationId: string, userId: string): Promise<LeadRow[]> {
  return withOrgTransaction(organizationId, userId, async (client) => {
    const result = await client.query<LeadRow>(
      "SELECT id, name, phone, property, budget, lead_status FROM leads WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 200",
      [organizationId]
    );
    return result.rows;
  });
}

export default async function LeadsPage() {
  const session = await readSession();
  if (!session) redirect("/login");

  const organizations = await getUserOrganizations(session.userId);
  const currentOrg = organizations[0];
  if (!currentOrg) redirect("/register");

  const leads = await listLeads(currentOrg.organizationId, session.userId);

  async function createAction(formData: FormData) {
    "use server";
    await createLead({
      organizationId: currentOrg!.organizationId,
      name: formData.get("name"),
      phone: formData.get("phone"),
      property: formData.get("property"),
      budget: formData.get("budget") || undefined,
    });
  }

  async function statusAction(formData: FormData) {
    "use server";
    await updateLeadStatus({
      organizationId: currentOrg!.organizationId,
      leadId: formData.get("leadId"),
      status: formData.get("status"),
    });
  }

  async function deleteAction(formData: FormData) {
    "use server";
    await deleteLead({ organizationId: currentOrg!.organizationId, leadId: formData.get("leadId") });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Leads</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          A Kanban view and WhatsApp-linked lead capture ship in a later phase.
        </p>
      </div>

      <form action={createAction} className="card flex flex-wrap items-end gap-3 p-4">
        <div className="flex-1 basis-32">
          <label className="mb-1 block text-xs font-medium text-ink-600">Name</label>
          <input name="name" required className="input-field" />
        </div>
        <div className="flex-1 basis-32">
          <label className="mb-1 block text-xs font-medium text-ink-600">Phone</label>
          <input name="phone" placeholder="+91…" className="input-field" />
        </div>
        <div className="flex-1 basis-32">
          <label className="mb-1 block text-xs font-medium text-ink-600">Property</label>
          <input name="property" placeholder="3BHK Sector 12" className="input-field" />
        </div>
        <div className="w-32">
          <label className="mb-1 block text-xs font-medium text-ink-600">Budget (₹)</label>
          <input name="budget" type="number" min="0" className="input-field" />
        </div>
        <button type="submit" className="btn-primary">
          Add lead
        </button>
      </form>

      {leads.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-ink-200 bg-white px-6 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
            <Target className="h-5 w-5" strokeWidth={2} />
          </span>
          <p className="text-sm text-ink-500">No leads yet — add one above.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Property</th>
                <th className="px-4 py-3">Budget</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-t border-ink-100">
                  <td className="px-4 py-3 font-medium text-ink-900">{l.name}</td>
                  <td className="px-4 py-3 text-ink-500">{l.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-500">{l.property ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-500">{l.budget ? `₹${Number(l.budget).toLocaleString("en-IN")}` : "—"}</td>
                  <td className="px-4 py-3">
                    <LeadStatusSelect leadId={l.id} currentStatus={l.lead_status} action={statusAction} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={deleteAction}>
                      <input type="hidden" name="leadId" value={l.id} />
                      <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
                        Delete
                      </button>
                    </form>
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
