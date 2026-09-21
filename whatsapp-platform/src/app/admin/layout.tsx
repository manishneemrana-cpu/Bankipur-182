import { redirect, notFound } from "next/navigation";
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
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white px-3 py-6">
        <div className="mb-6 px-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Platform</p>
          <p className="font-medium">Admin</p>
        </div>
        <AdminNavLinks />
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-slate-200 bg-white px-6 py-3">
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
