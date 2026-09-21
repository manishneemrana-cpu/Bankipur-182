import { redirect, notFound } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { readSession, requirePlatformAdminUserId } from "@/server/auth";
import { logoutAndRedirect } from "@/server/actions/auth-actions";
import { AdminNavLinks } from "./nav-links";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const adminUserId = await requirePlatformAdminUserId();
  if (adminUserId === null) {
    // Distinguish "not signed in" from "signed in but not an admin": the latter
    // gets a 404, not a redirect to /login, so it doesn't reveal that /admin exists
    // as a gated area to a signed-in non-admin.
    const session = await readSession();
    if (!session) redirect("/login");
    notFound();
  }

  return (
    <div className="flex min-h-screen bg-ink-50">
      <aside className="hidden w-64 shrink-0 flex-col bg-ink-950 px-4 py-5 sm:flex">
        <div className="flex items-center gap-2 px-2 text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
            <ShieldCheck className="h-4 w-4" strokeWidth={2.25} />
          </span>
          <span className="text-sm font-semibold">Platform Admin</span>
        </div>
        <div className="mt-6 flex-1 overflow-y-auto">
          <AdminNavLinks />
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-ink-100 bg-white px-6 py-3.5">
          <form action={logoutAndRedirect}>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-ink-500 hover:bg-ink-50 hover:text-ink-900"
            >
              <LogOut className="h-4 w-4" strokeWidth={2} />
              Log out
            </button>
          </form>
        </header>
        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
