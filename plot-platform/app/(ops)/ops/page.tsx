import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/data/current-user";
import { listOrgsForOps } from "@/lib/data/ops";

/** Platform ops console (§15, your side as SaaS owner): org list with plan,
 * status and usage. Mapping queue, impersonation, feature flags and global
 * templates aren't built in this pass — this is the org-list core the rest
 * would extend. */
export default async function OpsConsolePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isPlatformOwner) redirect("/dashboard");

  const orgs = await listOrgsForOps();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Platform ops console
        </h1>
        <p className="text-sm text-muted-foreground">
          {orgs.length} organization{orgs.length === 1 ? "" : "s"}.
        </p>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="px-3 py-2 font-medium">Org</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Plan</th>
              <th className="px-3 py-2 font-medium">Projects</th>
              <th className="px-3 py-2 font-medium">
                AI messages (this month)
              </th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((o) => (
              <tr key={o.id} className="border-b border-border">
                <td className="px-3 py-2 font-medium">{o.name}</td>
                <td className="px-3 py-2">{o.status}</td>
                <td className="px-3 py-2 capitalize">{o.planName}</td>
                <td className="tabular px-3 py-2">{o.projectCount}</td>
                <td className="tabular px-3 py-2">{o.aiMessagesThisMonth}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {orgs.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No organizations yet.
          </p>
        ) : null}
      </div>
    </div>
  );
}
