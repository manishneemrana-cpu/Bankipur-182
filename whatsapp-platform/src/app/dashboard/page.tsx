import { readSession } from "@/server/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await readSession();
  if (!session) redirect("/login");

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-slate-600">
        Phase 1 stub. Inbox, Contacts, Leads, Campaigns, Templates, Automation, WhatsApp
        connection status, Team, Analytics, Billing and Settings ship in later phases.
      </p>
    </main>
  );
}
