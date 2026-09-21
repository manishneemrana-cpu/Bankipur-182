import { redirect } from "next/navigation";
import { readSession } from "@/server/auth";
import { logoutAndRedirect } from "@/server/actions/auth-actions";
import { getUserOrganizations } from "@/server/organization";
import { withSystemClient } from "@/server/db";
import { DashboardNavLinks } from "./nav-links";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session) redirect("/login");

  const [organizations, email] = await Promise.all([
    getUserOrganizations(session.userId),
    withSystemClient((client) =>
      client
        .query<{ email: string }>("SELECT email FROM users WHERE id = $1", [session.userId])
        .then((r) => r.rows[0]?.email ?? "")
    ),
  ]);

  if (organizations.length === 0) {
    // Shouldn't happen: registerOrganization always creates the founding membership.
    // If it ever does, sending the user back to registration is safer than a blank/broken dashboard.
    redirect("/register");
  }

  const currentOrg = organizations[0]!;

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white px-3 py-6">
        <div className="mb-6 px-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Organization</p>
          <p className="truncate font-medium">{currentOrg.brandName ?? currentOrg.organizationName}</p>
        </div>
        <DashboardNavLinks />
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <p className="text-sm text-slate-600">{email}</p>
          <form action={logoutAndRedirect}>
            <button type="submit" className="text-sm text-slate-600 underline">
              Log out
            </button>
          </form>
        </header>
        <main className="flex-1 bg-slate-50 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
