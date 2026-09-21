import { withPlatformAdminTransaction } from "@/server/db";

interface OverviewCounts {
  totalOrganizations: number;
  activeOrganizations: number;
  suspendedOrganizations: number;
  totalUsers: number;
}

async function getOverviewCounts(): Promise<OverviewCounts> {
  return withPlatformAdminTransaction(async (client) => {
    const orgCounts = await client.query<{ status: string; count: string }>(
      "SELECT status, count(*) FROM organizations GROUP BY status"
    );
    const userCount = await client.query<{ count: string }>("SELECT count(*) FROM users");

    const byStatus = Object.fromEntries(orgCounts.rows.map((r) => [r.status, Number(r.count)]));
    const totalOrganizations = orgCounts.rows.reduce((sum, r) => sum + Number(r.count), 0);

    return {
      totalOrganizations,
      activeOrganizations: byStatus.active ?? 0,
      suspendedOrganizations: byStatus.suspended ?? 0,
      totalUsers: Number(userCount.rows[0]?.count ?? 0),
    };
  });
}

export default async function AdminOverviewPage() {
  const counts = await getOverviewCounts();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Overview</h1>
        <p className="mt-1 text-sm text-slate-600">
          Real counts from the database. Message volume, revenue, and webhook health ship once
          those features exist (later phases). Per the platform&apos;s privacy rule, this view
          never shows customer message content.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="Organizations" value={counts.totalOrganizations} />
        <StatCard label="Active" value={counts.activeOrganizations} />
        <StatCard label="Suspended" value={counts.suspendedOrganizations} />
        <StatCard label="Users" value={counts.totalUsers} />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
