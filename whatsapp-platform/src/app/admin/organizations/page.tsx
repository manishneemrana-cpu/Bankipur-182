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

export default async function AdminOrganizationsPage() {
  const organizations = await listOrganizations();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Organizations</h1>
        <p className="mt-1 text-sm text-slate-600">
          Suspending an organization, and viewing its onboarding/WhatsApp connection status,
          ship once those features exist (later phases).
        </p>
      </div>

      {organizations.length === 0 ? (
        <p className="text-sm text-slate-600">No organizations yet.</p>
      ) : (
        <table className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Members</th>
              <th className="px-4 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {organizations.map((o) => (
              <tr key={o.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{o.name}</td>
                <td className="px-4 py-2 text-slate-600">{o.status}</td>
                <td className="px-4 py-2 text-slate-600">{o.memberCount}</td>
                <td className="px-4 py-2 text-slate-600">{new Date(o.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
