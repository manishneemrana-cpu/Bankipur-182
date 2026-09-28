import { createClient } from "@/lib/db/supabase/server";

/** CSV export of a project's leads (§13), respecting the same RLS as the UI. */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/dashboard/projects/[projectId]/leads/export">,
) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("name, phone, email, source, stage, created_at, plot_ids")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) return new Response(error.message, { status: 400 });

  const header = "name,phone,email,source,stage,created_at,plot_count";
  const rows = (data ?? []).map((l) =>
    [
      l.name,
      l.phone,
      l.email ?? "",
      l.source,
      l.stage,
      l.created_at,
      (l.plot_ids ?? []).length,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  const csv = [header, ...rows].join("\n");

  return new Response(csv, {
    headers: {
      "content-type": "text/csv",
      "content-disposition": `attachment; filename="leads-${projectId}.csv"`,
    },
  });
}
