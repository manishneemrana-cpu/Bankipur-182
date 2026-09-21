import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { readSession } from "@/server/auth";
import { getUserOrganizations } from "@/server/organization";
import { getMockTemplates, isMockModeEnabled } from "@/server/mock/meta";

const STATUS_STYLES: Record<string, string> = {
  APPROVED: "bg-brand-100 text-brand-800",
  PENDING: "bg-amber-100 text-amber-800",
  REJECTED: "bg-red-100 text-red-800",
  DRAFT: "bg-ink-100 text-ink-700",
  PAUSED: "bg-ink-100 text-ink-700",
};

export default async function TemplatesPage() {
  const session = await readSession();
  if (!session) redirect("/login");

  const organizations = await getUserOrganizations(session.userId);
  const currentOrg = organizations[0];
  if (!currentOrg) redirect("/register");

  const templates = getMockTemplates(currentOrg.organizationId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Templates</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Creating and submitting real message templates to Meta ships in Phase 4.{" "}
          {isMockModeEnabled()
            ? "The list below is simulated demo data."
            : "No templates exist yet."}
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-ink-200 bg-white px-6 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
            <FileText className="h-5 w-5" strokeWidth={2} />
          </span>
          <p className="text-sm text-ink-500">No templates yet.</p>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
