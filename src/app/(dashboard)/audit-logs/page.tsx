import { getCurrentUser } from "@/lib/data/current-user";
import { getAuditLogs } from "@/lib/data/approvals";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";

export default async function AuditLogsPage() {
  const user = await getCurrentUser();
  if (!user.organizationId) return null;

  const logs = await getAuditLogs(user.organizationId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Audit Logs</h1>
        <p className="text-muted-foreground text-sm">
          Append-only. No UPDATE or DELETE policy exists on this table for
          any role — every row here is exactly what happened.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Actions</CardTitle>
          <CardDescription>{logs.length} entries (latest 100)</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const agent = log.agents as unknown as { name: string } | null;
                const actor = log.profiles as unknown as { full_name: string | null } | null;
                return (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(log.created_at)}
                    </TableCell>
                    <TableCell className="font-medium">{log.action}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {log.department?.replace("_", " ") ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{agent?.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {actor?.full_name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.environment}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.status === "success" ? "success" : "destructive"}>
                        {log.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {logs.length === 0 && (
            <p className="text-muted-foreground pt-4 text-sm">No actions logged yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
