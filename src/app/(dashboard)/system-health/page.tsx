import { getCurrentUser } from "@/lib/data/current-user";
import { getSystemHealth } from "@/lib/data/system-health";
import { WORKFLOW_TEMPLATES } from "@/lib/n8n/workflow-templates";
import { activateIntegration, checkSitesNSignConnection } from "./actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

const SERVICE_LABEL: Record<string, string> = {
  database: "Database",
  ai_provider: "AI Provider",
  n8n: "n8n",
  sitesnsign_connector: "SitesNSign Connector",
  meta: "Meta",
  whatsapp: "WhatsApp",
  calling: "Calling",
  calendar: "Calendar",
  email: "Email",
};

export default async function SystemHealthPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await getCurrentUser();
  if (!user.organizationId) return null;

  const health = await getSystemHealth(user.organizationId);
  const canActivate = user.role === "OWNER" || user.role === "ADMIN";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">System Health</h1>
        <p className="text-muted-foreground text-sm">
          Honest status per integration — nothing is marked healthy without
          a real, verified connection. LIVE activation is OWNER/ADMIN only
          and per integration; it records governance intent, it cannot by
          itself manufacture a real connection where no credentials exist.
        </p>
        {error && <p className="text-destructive mt-2 text-sm">{decodeURIComponent(error)}</p>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Integrations</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead>Activated by</TableHead>
                <TableHead>Last checked</TableHead>
                {canActivate && <TableHead></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {health.map((h) => {
                const activator = h.profiles as unknown as { full_name: string | null } | null;
                return (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium">{SERVICE_LABEL[h.service] ?? h.service}</TableCell>
                    <TableCell>
                      <StatusBadge status={h.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{h.detail}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {h.activated_at ? (
                        <>
                          {activator?.full_name ?? "—"}
                          <br />
                          {formatDateTime(h.activated_at)}
                        </>
                      ) : (
                        <Badge variant="outline">not activated</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(h.last_checked_at)}
                    </TableCell>
                    {canActivate && (
                      <TableCell>
                        <div className="flex gap-2">
                          {h.service === "sitesnsign_connector" && (
                            <form action={checkSitesNSignConnection}>
                              <input type="hidden" name="healthId" value={h.id} />
                              <Button type="submit" size="sm" variant="outline">
                                Check Connection
                              </Button>
                            </form>
                          )}
                          {!h.activated_at && (
                            <form action={activateIntegration}>
                              <input type="hidden" name="healthId" value={h.id} />
                              <Button type="submit" size="sm" variant="outline">
                                Activate
                              </Button>
                            </form>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">n8n Workflow Templates</CardTitle>
          <CardDescription>
            Documented templates, not deployed to any live n8n instance yet.
            externalAction marks which ones the safety guard gates in LIVE mode.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {WORKFLOW_TEMPLATES.map((t) => (
            <div key={t.key} className="border-border flex items-center justify-between rounded-md border p-2">
              <div>
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-muted-foreground text-xs">{t.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{t.triggerEvent}</Badge>
                {t.externalAction && <Badge variant="warning">external action</Badge>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
