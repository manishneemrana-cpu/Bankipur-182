import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { readSession } from "@/server/auth";
import { getUserOrganizations } from "@/server/organization";
import { withOrgTransaction } from "@/server/db";
import { isMockModeEnabled } from "@/server/mock/meta";
import {
  createTemplate,
  deleteTemplate,
  mockApproveTemplate,
  submitTemplateForReview,
} from "@/server/actions/template-actions";

const STATUS_STYLES: Record<string, string> = {
  APPROVED: "bg-brand-100 text-brand-800",
  PENDING: "bg-amber-100 text-amber-800",
  REJECTED: "bg-red-100 text-red-800",
  DRAFT: "bg-ink-100 text-ink-700",
  PAUSED: "bg-ink-100 text-ink-700",
};

interface TemplateRow {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
}

async function listTemplates(organizationId: string, userId: string): Promise<TemplateRow[]> {
  return withOrgTransaction(organizationId, userId, async (client) => {
    const result = await client.query<TemplateRow>(
      "SELECT id, name, language, category, status FROM message_templates WHERE organization_id = $1 ORDER BY created_at DESC",
      [organizationId]
    );
    return result.rows;
  });
}

export default async function TemplatesPage() {
  const session = await readSession();
  if (!session) redirect("/login");

  const organizations = await getUserOrganizations(session.userId);
  const currentOrg = organizations[0];
  if (!currentOrg) redirect("/register");

  const templates = await listTemplates(currentOrg.organizationId, session.userId);
  const mockMode = isMockModeEnabled();

  async function createAction(formData: FormData) {
    "use server";
    await createTemplate({
      organizationId: currentOrg!.organizationId,
      name: formData.get("name"),
      language: formData.get("language"),
      category: formData.get("category"),
    });
  }

  async function submitAction(formData: FormData) {
    "use server";
    await submitTemplateForReview({
      organizationId: currentOrg!.organizationId,
      templateId: formData.get("templateId"),
    });
  }

  async function deleteAction(formData: FormData) {
    "use server";
    await deleteTemplate({ organizationId: currentOrg!.organizationId, templateId: formData.get("templateId") });
  }

  async function mockApproveAction(formData: FormData) {
    "use server";
    await mockApproveTemplate({
      organizationId: currentOrg!.organizationId,
      templateId: formData.get("templateId"),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Templates</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Submitting a template here does not yet call Meta&apos;s real template API (Phase 5+) —
          it only exercises this platform&apos;s own draft/pending/approved workflow.
        </p>
      </div>

      <form action={createAction} className="card flex flex-wrap items-end gap-3 p-4">
        <div className="flex-1 basis-40">
          <label className="mb-1 block text-xs font-medium text-ink-600">Name</label>
          <input name="name" placeholder="site_visit_reminder" required className="input-field" />
        </div>
        <div className="w-28">
          <label className="mb-1 block text-xs font-medium text-ink-600">Language</label>
          <input name="language" defaultValue="en" required className="input-field" />
        </div>
        <div className="w-44">
          <label className="mb-1 block text-xs font-medium text-ink-600">Category</label>
          <select name="category" required className="input-field">
            <option value="UTILITY">Utility</option>
            <option value="MARKETING">Marketing</option>
            <option value="AUTHENTICATION">Authentication</option>
          </select>
        </div>
        <button type="submit" className="btn-primary">
          New template
        </button>
      </form>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-ink-200 bg-white px-6 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
            <FileText className="h-5 w-5" strokeWidth={2} />
          </span>
          <p className="text-sm text-ink-500">No templates yet — create one above.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Language</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-t border-ink-100">
                  <td className="px-4 py-3 font-medium text-ink-900">{t.name}</td>
                  <td className="px-4 py-3 text-ink-500">{t.language}</td>
                  <td className="px-4 py-3 text-ink-500">{t.category}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[t.status]}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {t.status === "DRAFT" && (
                        <form action={submitAction}>
                          <input type="hidden" name="templateId" value={t.id} />
                          <button type="submit" className="text-xs font-medium text-brand-700 hover:underline">
                            Submit for review
                          </button>
                        </form>
                      )}
                      {mockMode && t.status === "PENDING" && (
                        <form action={mockApproveAction}>
                          <input type="hidden" name="templateId" value={t.id} />
                          <button type="submit" className="text-xs font-medium text-amber-700 hover:underline">
                            Mock: approve
                          </button>
                        </form>
                      )}
                      <form action={deleteAction}>
                        <input type="hidden" name="templateId" value={t.id} />
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
