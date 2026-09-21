import { readSession } from "@/server/auth";
import { getUserOrganizations } from "@/server/organization";
import { getMockWhatsappConnection, isMockModeEnabled } from "@/server/mock/meta";
import { redirect } from "next/navigation";

export default async function DashboardOverviewPage() {
  const session = await readSession();
  if (!session) redirect("/login");

  const organizations = await getUserOrganizations(session.userId);
  const currentOrg = organizations[0];
  if (!currentOrg) redirect("/register");

  const connection = getMockWhatsappConnection(currentOrg.organizationId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Overview</h1>
        <p className="text-sm text-slate-600">
          Signed in as {currentOrg.role.toLowerCase()} of {currentOrg.organizationName}.
        </p>
      </div>

      {isMockModeEnabled() ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Mock mode is on — the WhatsApp status below is simulated demo data, not a real
          connection. No real WhatsApp message can be sent while this is on.
        </div>
      ) : (
        <div className="rounded-md border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700">
          No WhatsApp number connected yet. Connecting a real WhatsApp Business number is not
          built yet (planned for a later phase).
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="WhatsApp status" value={connection ? connection.connectionStatus : "NOT CONNECTED"} />
        <StatCard label="Quality rating" value={connection?.qualityRating ?? "—"} />
        <StatCard label="Messaging tier" value={connection?.messagingLimitTier ?? "—"} />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
