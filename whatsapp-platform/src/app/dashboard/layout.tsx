import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { readSession } from "@/server/auth";
import { logoutAndRedirect } from "@/server/actions/auth-actions";
import { getUserOrganizations } from "@/server/organization";
import { getEnv } from "@/server/env";
import { withSystemClient } from "@/server/db";
import { Logo } from "@/components/logo";
import { DashboardNavLinks } from "./nav-links";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session) redirect("/login");

  const env = getEnv();
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
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen bg-ink-50">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-ink-100 bg-white px-4 py-5 sm:flex">
        <Logo brandName={env.PLATFORM_BRAND_NAME} className="px-2" />

        <div className="mt-6 rounded-lg border border-ink-100 bg-ink-50 px-3 py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-400">Organization</p>
          <p className="truncate text-sm font-semibold text-ink-900">
            {currentOrg.brandName ?? currentOrg.organizationName}
          </p>
          <span className="mt-1 inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-800">
            {currentOrg.role}
          </span>
        </div>

        <div className="mt-6 flex-1 overflow-y-auto">
          <DashboardNavLinks />
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-ink-100 bg-white px-6 py-3.5">
          <div className="sm:hidden">
            <Logo brandName={env.PLATFORM_BRAND_NAME} />
          </div>
          <div className="hidden sm:block" />
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink-600">{email}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-900 text-xs font-semibold text-white">
              {initials}
            </span>
            <form action={logoutAndRedirect}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-ink-500 hover:bg-ink-50 hover:text-ink-900"
              >
                <LogOut className="h-4 w-4" strokeWidth={2} />
                Log out
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
