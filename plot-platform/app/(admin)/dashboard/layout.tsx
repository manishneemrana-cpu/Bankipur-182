import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/data/current-user";

import { signOut } from "./actions";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/projects", label: "Projects" },
];

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.memberships.length === 0 && !user.isPlatformOwner)
    redirect("/setup-org");

  const org = user.memberships[0];

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="flex flex-row items-center justify-between gap-4 border-b border-border p-4 md:w-56 md:flex-col md:items-stretch md:border-r md:border-b-0">
        <div>
          <p className="text-sm font-semibold">{org?.orgName ?? "Platform"}</p>
          <p className="text-xs text-muted-foreground">
            {org?.role ?? "platform_owner"}
          </p>
        </div>
        <nav className="flex gap-3 text-sm md:flex-col md:gap-1">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="hover:underline">
              {item.label}
            </Link>
          ))}
        </nav>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-muted-foreground hover:underline"
          >
            Sign out
          </button>
        </form>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
