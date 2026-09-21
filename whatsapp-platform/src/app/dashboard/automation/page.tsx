import { redirect } from "next/navigation";
import { Zap } from "lucide-react";
import { readSession } from "@/server/auth";
import { getUserOrganizations } from "@/server/organization";
import { withOrgTransaction } from "@/server/db";
import { createAutomation, deleteAutomation, toggleAutomation } from "@/server/actions/automation-actions";
import { CreateAutomationForm } from "./create-form";

interface AutomationRow {
  id: string;
  name: string;
  trigger_type: string;
  enabled: boolean;
}

async function listAutomations(organizationId: string, userId: string): Promise<AutomationRow[]> {
  return withOrgTransaction(organizationId, userId, async (client) => {
    const result = await client.query<AutomationRow>(
      "SELECT id, name, trigger_type, enabled FROM automations WHERE organization_id = $1 ORDER BY created_at DESC",
      [organizationId]
    );
    return result.rows;
  });
}

const TRIGGER_LABELS: Record<string, string> = {
  welcome_message: "Welcome message",
  keyword_auto_reply: "Keyword auto-reply",
  business_hours_away: "Away message (outside business hours)",
};

export default async function AutomationPage() {
  const session = await readSession();
  if (!session) redirect("/login");

  const organizations = await getUserOrganizations(session.userId);
  const currentOrg = organizations[0];
  if (!currentOrg) redirect("/register");

  const automations = await listAutomations(currentOrg.organizationId, session.userId);

  async function createAction(formData: FormData) {
    "use server";
    await createAutomation({
      organizationId: currentOrg!.organizationId,
      name: formData.get("name"),
      triggerType: formData.get("triggerType"),
      keywords: formData.get("keywords"),
      hoursStart: formData.get("hoursStart"),
      hoursEnd: formData.get("hoursEnd"),
      replyBody: formData.get("replyBody"),
    });
  }

  async function toggleAction(formData: FormData) {
    "use server";
    await toggleAutomation({ organizationId: currentOrg!.organizationId, automationId: formData.get("automationId") });
  }

  async function deleteAction(formData: FormData) {
    "use server";
    await deleteAutomation({ organizationId: currentOrg!.organizationId, automationId: formData.get("automationId") });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Automation</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          The full trigger/action catalogue (n8n webhooks, AI, lead events) ships in a later
          phase. These three ready-made basics run today, from a real inbound WhatsApp message.
        </p>
      </div>

      <CreateAutomationForm action={createAction} />

      {automations.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-ink-200 bg-white px-6 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
            <Zap className="h-5 w-5" strokeWidth={2} />
          </span>
          <p className="text-sm text-ink-500">No automations yet.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Trigger</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {automations.map((a) => (
                <tr key={a.id} className="border-t border-ink-100">
                  <td className="px-4 py-3 font-medium text-ink-900">{a.name}</td>
                  <td className="px-4 py-3 text-ink-500">{TRIGGER_LABELS[a.trigger_type] ?? a.trigger_type}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        a.enabled ? "bg-brand-100 text-brand-800" : "bg-ink-100 text-ink-600"
                      }`}
                    >
                      {a.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <form action={toggleAction}>
                        <input type="hidden" name="automationId" value={a.id} />
                        <button type="submit" className="text-xs font-medium text-brand-700 hover:underline">
                          {a.enabled ? "Disable" : "Enable"}
                        </button>
                      </form>
                      <form action={deleteAction}>
                        <input type="hidden" name="automationId" value={a.id} />
                        <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
                          Delete
                        </button>
                      </form>
                    </div>
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
