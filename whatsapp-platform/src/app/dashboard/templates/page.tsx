import { redirect } from "next/navigation";
import { readSession } from "@/server/auth";
import { getUserOrganizations } from "@/server/organization";
import { getMockTemplates, isMockModeEnabled } from "@/server/mock/meta";

const STATUS_STYLES: Record<string, string> = {
  APPROVED: "bg-green-100 text-green-800",
  PENDING: "bg-amber-100 text-amber-800",
  REJECTED: "bg-red-100 text-red-800",
  DRAFT: "bg-slate-100 text-slate-700",
  PAUSED: "bg-slate-100 text-slate-700",
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
        <h1 className="text-xl font-semibold">Templates</h1>
        <p className="mt-1 text-sm text-slate-600">
          Creating and submitting real message templates to Meta ships in Phase 4.{" "}
          {isMockModeEnabled()
            ? "The list below is simulated demo data."
            : "No templates exist yet."}
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          No templates yet.
        </div>
      ) : (
        <table className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Language</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{t.name}</td>
                <td className="px-4 py-2 text-slate-600">{t.language}</td>
                <td className="px-4 py-2 text-slate-600">{t.category}</td>
                <td className="px-4 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLES[t.status]}`}>{t.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
