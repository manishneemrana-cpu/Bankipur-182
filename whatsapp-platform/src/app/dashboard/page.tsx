import { redirect } from "next/navigation";
import { CheckCircle2, MessageCircle, Gauge, Signal } from "lucide-react";
import { readSession } from "@/server/auth";
import { getUserOrganizations } from "@/server/organization";
import { getMockWhatsappConnection, isMockModeEnabled } from "@/server/mock/meta";

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
        <h1 className="text-xl font-semibold text-ink-900">Overview</h1>
        <p className="mt-1 text-sm text-ink-500">
          Signed in as <span className="font-medium text-ink-700">{currentOrg.role.toLowerCase()}</span> of{" "}
          <span className="font-medium text-ink-700">{currentOrg.organizationName}</span>.
        </p>
      </div>

      {isMockModeEnabled() ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-900">
          <Signal className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          <span>
            Mock mode is on — the WhatsApp status below is simulated demo data, not a real
            connection. No real WhatsApp message can be sent while this is on.
          </span>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-xl border border-ink-200 bg-white px-4 py-3.5 text-sm text-ink-600">
          <MessageCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          <span>No WhatsApp number connected yet. Connecting one ships in a later phase.</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={CheckCircle2}
          label="WhatsApp status"
          value={connection ? connection.connectionStatus : "NOT CONNECTED"}
        />
        <StatCard icon={Gauge} label="Quality rating" value={connection?.qualityRating ?? "—"} />
        <StatCard icon={Signal} label="Messaging tier" value={connection?.messagingLimitTier ?? "—"} />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof CheckCircle2;
}) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>
      <div>
        <p className="text-xs uppercase tracking-wide text-ink-400">{label}</p>
        <p className="mt-0.5 text-base font-semibold text-ink-900">{value}</p>
      </div>
    </div>
  );
}
