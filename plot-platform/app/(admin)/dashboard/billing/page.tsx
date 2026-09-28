import { redirect } from "next/navigation";

import { getBillingProvider } from "@/lib/billing/provider";
import { getCurrentUser } from "@/lib/data/current-user";
import { getPlanUsage } from "@/lib/data/analytics";

const LIMIT_LABELS: Record<string, string> = {
  projects: "Projects",
  plots: "Plots",
  ai_messages_per_month: "AI messages this month",
};

export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const org = user.memberships[0];
  if (!org) redirect("/setup-org");

  const usage = await getPlanUsage(org.orgId);
  const provider = getBillingProvider();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground">
          {org.orgName} is on the{" "}
          <span className="font-medium">{usage.planName}</span> plan
          {usage.priceInrMonthly > 0
            ? ` (₹${usage.priceInrMonthly.toLocaleString("en-IN")}/month)`
            : " (free)"}
          .
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {Object.entries(LIMIT_LABELS).map(([key, label]) => {
          const limit = usage.limits[key];
          const used = usage.usage[key] ?? 0;
          const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
          return (
            <div key={key} className="flex flex-col gap-1">
              <div className="flex justify-between text-sm">
                <span>{label}</span>
                <span className="tabular text-muted-foreground">
                  {used}
                  {limit ? ` / ${limit}` : " (unlimited)"}
                </span>
              </div>
              {limit ? (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="rounded-md border p-4 text-sm">
        {provider ? (
          <p>Upgrade options are available.</p>
        ) : (
          <p className="text-muted-foreground">
            Payments aren&apos;t configured in this environment (no Razorpay
            keys) — upgrading is a manual, off-app step for now. Limits above
            are enforced regardless.
          </p>
        )}
      </div>
    </div>
  );
}
