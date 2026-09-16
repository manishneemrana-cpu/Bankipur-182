import { redirect } from "next/navigation";

import { logout } from "./login/actions";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, organization_id, organizations(name, mode)")
    .eq("id", user.id)
    .single();

  const org = profile?.organizations as unknown as
    | { name: string; mode: string }
    | null
    | undefined;

  return (
    <div className="mx-auto flex min-h-svh max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">SitesNSign AI Executive</h1>
        <form action={logout}>
          <Button variant="outline" size="sm" type="submit">
            Sign out
          </Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Signed in as {profile?.full_name || user.email}</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant="secondary">Role: {profile?.role ?? "VIEWER"}</Badge>
          <Badge variant={org ? "success" : "warning"}>
            {org ? `Org: ${org.name}` : "No organization assigned"}
          </Badge>
          {org && <Badge variant="outline">Mode: {org.mode.toUpperCase()}</Badge>}
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-sm">
        Phase 1 (scaffold, schema, auth) complete. The Executive Overview
        dashboard with demo data arrives in Phase 2.
      </p>
    </div>
  );
}
