import { getCurrentUser } from "@/lib/data/current-user";
import { getTasks } from "@/lib/data/dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime } from "@/lib/format";

export default async function AutomationPage() {
  const user = await getCurrentUser();
  if (!user.organizationId) return null;

  const tasks = await getTasks(user.organizationId);
  const automationTasks = tasks.filter((t) => t.department === "automation");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Automation</h1>
        <p className="text-muted-foreground text-sm">
          MAPEX Extraction/Enrichment, Aman Voice Agent Ops, n8n Workflow
          Engineer, and WhatsApp SaaS Onboarding worker agents land here in
          Phase 3. Live n8n integration arrives in Phase 5, gated per the
          environment safety rules (no external actions outside LIVE mode).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Automation Tasks</CardTitle>
          <CardDescription>{automationTasks.length} open items</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {automationTasks.map((t) => (
            <div key={t.id} className="border-border flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">{t.title}</p>
                {t.due_at && (
                  <p className="text-muted-foreground text-xs">Due {formatDateTime(t.due_at)}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{t.priority}</Badge>
                <StatusBadge status={t.status} />
              </div>
            </div>
          ))}
          {automationTasks.length === 0 && (
            <p className="text-muted-foreground text-sm">No open items.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
