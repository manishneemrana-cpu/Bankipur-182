import { NextResponse, type NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/format";

/**
 * Read-only, shared-secret-protected endpoint for external automation
 * (n8n, etc.) to pull overdue follow-ups without ever handing out the
 * Supabase service-role key itself. One narrow purpose-built endpoint
 * instead of a master key - if this secret leaks, only this one read is
 * exposed, not the whole database.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.N8N_READ_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const provided = request.headers.get("x-integration-secret");
  if (!provided || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  const { data, error } = await admin
    .from("followups")
    .select("id, due_at, channel, notes, leads(name, phone)")
    .eq("status", "overdue")
    .order("due_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = (data ?? []).map((f) => {
    const lead = f.leads as unknown as { name: string; phone: string | null } | null;
    return {
      id: f.id,
      leadName: lead?.name ?? "Unknown",
      phone: lead?.phone ?? null,
      dueAt: f.due_at,
      channel: f.channel,
      notes: f.notes,
    };
  });

  const summary =
    items.length === 0
      ? "No overdue follow-ups."
      : items
          .map((i) => `• ${i.leadName} (${i.phone ?? "no phone"}) — due ${formatDateTime(i.dueAt)} via ${i.channel}`)
          .join("\n");

  return NextResponse.json({ count: items.length, summary, items });
}
