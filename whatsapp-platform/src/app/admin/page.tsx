import { Building2, CheckCircle2, PauseCircle, Users } from "lucide-react";
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
        <h1 className="text-xl font-semibold text-ink-900">Overview</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Real counts from the database. Message volume, revenue, and webhook health ship once
          those features exist (later phases). Per the platform&apos;s privacy rule, this view
          never shows customer message content.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard icon={Building2} label="Organizations" value={counts.totalOrganizations} />
        <StatCard icon={CheckCircle2} label="Active" value={counts.activeOrganizations} accent="text-brand-700" />
        <StatCard icon={PauseCircle} label="Suspended" value={counts.suspendedOrganizations} accent="text-amber-700" />
        <StatCard icon={Users} label="Users" value={counts.totalUsers} />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent = "text-ink-900",
}: {
  label: string;
  value: number;
  icon: typeof Building2;
  accent?: string;
}) {
  return (
    <div className="card p-5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>
      <p className="mt-3 text-xs uppercase tracking-wide text-ink-400">{label}</p>
      <p className={`mt-0.5 text-2xl font-semibold ${accent}`}>{value}</p>
    </div>
  );
}
