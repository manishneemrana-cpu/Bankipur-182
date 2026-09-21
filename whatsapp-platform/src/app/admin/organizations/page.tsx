import { withPlatformAdminTransaction } from "@/server/db";

interface OrgRow {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  memberCount: number;
}

async function listOrganizations(): Promise<OrgRow[]> {
  return withPlatformAdminTransaction(async (client) => {
    const result = await client.query<{
      id: string;
      name: string;
      status: string;
      created_at: string;
      member_count: string;
    }>(
      `SELECT o.id, o.name, o.status, o.created_at, count(m.id) AS member_count
       FROM organizations o
       LEFT JOIN organization_members m ON m.organization_id = o.id
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT 100`
    );
    return result.rows.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      createdAt: r.created_at,
      memberCount: Number(r.member_count),
    }));
  });
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-brand-100 text-brand-800",
  suspended: "bg-amber-100 text-amber-800",
  closed: "bg-ink-100 text-ink-600",
};

export default async function AdminOrganizationsPage() {
  const organizations = await listOrganizations();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Organizations</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Suspending an organization, and viewing its onboarding/WhatsApp connection status,
          ship once those features exist (later phases).
        </p>
      </div>

      {organizations.length === 0 ? (
        <p className="text-sm text-ink-500">No organizations yet.</p>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Members</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((o) => (
                <tr key={o.id} className="border-t border-ink-100">
                  <td className="px-4 py-3 font-medium text-ink-900">{o.name}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[o.status] ?? "bg-ink-100 text-ink-600"}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-500">{o.memberCount}</td>
                  <td className="px-4 py-3 text-ink-500">{new Date(o.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
