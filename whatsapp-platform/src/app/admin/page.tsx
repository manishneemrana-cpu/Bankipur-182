import { readSession } from "@/server/auth";
import { withSystemClient } from "@/server/db";
import { redirect, notFound } from "next/navigation";

export default async function AdminPage() {
  const session = await readSession();
  if (!session) redirect("/login");

  const isAdmin = await withSystemClient(async (client) => {
    const result = await client.query<{ is_platform_admin: boolean }>(
      "SELECT is_platform_admin FROM users WHERE id = $1",
      [session.userId]
    );
    return result.rows[0]?.is_platform_admin ?? false;
  });
  if (!isAdmin) notFound();

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-xl font-semibold">Admin</h1>
      <p className="mt-2 text-slate-600">
        Phase 1 stub. Organizations, connected WABAs, onboarding status, usage, revenue, webhook
        health, plans/pricing and audit logs ship in later phases. Per the platform&apos;s privacy
        rule, admins do not see customer message content by default.
      </p>
    </main>
  );
}
