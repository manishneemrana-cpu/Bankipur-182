import { getCurrentUser } from "@/lib/data/current-user";
import { getRevenueEntries, getTasks } from "@/lib/data/dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/kpi-card";
import { formatInr, formatDate, formatDateTime } from "@/lib/format";

export default async function FinanceLegalPage() {
  const user = await getCurrentUser();
  if (!user.organizationId) return null;

  const [entries, tasks] = await Promise.all([
    getRevenueEntries(user.organizationId),
    getTasks(user.organizationId),
  ]);

  const inflow = entries.filter((e) => Number(e.amount_inr) > 0).reduce((s, e) => s + Number(e.amount_inr), 0);
  const outflow = entries.filter((e) => Number(e.amount_inr) < 0).reduce((s, e) => s + Number(e.amount_inr), 0);
  const net = inflow + outflow;

  const financeTasks = tasks.filter((t) => t.department === "finance_legal");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Finance &amp; Legal</h1>
        <p className="text-muted-foreground text-sm">
          Financial Statement Builder, Invoice &amp; Cash Watcher,
          Compliance Checker, and Contract Reviewer worker agents land here
          in Phase 3. No financial/legal guarantees are made by this system.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Inflow" value={formatInr(inflow)} />
        <KpiCard label="Outflow" value={formatInr(Math.abs(outflow))} tone="warning" />
        <KpiCard label="Net (demo)" value={formatInr(net)} tone={net < 0 ? "critical" : "default"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue &amp; Spend Entries</CardTitle>
          <CardDescription>
            Illustrative demo entries — not linked to any real accounting system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.category}</TableCell>
                  <TableCell className="text-muted-foreground">{e.description}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(e.entry_date)}</TableCell>
                  <TableCell className={Number(e.amount_inr) < 0 ? "text-destructive" : "text-success"}>
                    {formatInr(Number(e.amount_inr))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compliance &amp; Contract Tasks</CardTitle>
          <CardDescription>{financeTasks.length} open items</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {financeTasks.map((t) => (
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
          {financeTasks.length === 0 && (
            <p className="text-muted-foreground text-sm">No open items.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
