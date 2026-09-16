import { logout } from "@/app/login/actions";
import { getCurrentUser } from "@/lib/data/current-user";
import { SidebarNav } from "@/components/sidebar-nav";
import { ModeBadge } from "@/components/mode-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-svh">
      <aside className="border-border hidden w-64 shrink-0 border-r p-4 md:flex md:flex-col md:gap-4">
        <div className="px-3 py-2">
          <p className="text-sm font-semibold">SitesNSign AI Executive</p>
          <p className="text-muted-foreground text-xs">CEO Command Center</p>
        </div>
        <SidebarNav />
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="border-border flex items-center justify-between gap-4 border-b px-6 py-3">
          <div className="flex items-center gap-2">
            <ModeBadge mode={user.organizationMode} />
            {user.organizationName && (
              <span className="text-muted-foreground text-sm">{user.organizationName}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">{user.role}</Badge>
            <span className="text-muted-foreground hidden text-sm sm:inline">
              {user.fullName || user.email}
            </span>
            <form action={logout}>
              <Button variant="outline" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
