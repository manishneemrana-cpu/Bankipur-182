import { getCurrentUser } from "@/lib/data/current-user";
import { getCampaigns, getSocialPosts } from "@/lib/data/dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { formatInr, formatDateTime } from "@/lib/format";

export default async function MarketingPage() {
  const user = await getCurrentUser();
  if (!user.organizationId) return null;

  const [campaigns, posts] = await Promise.all([
    getCampaigns(user.organizationId),
    getSocialPosts(user.organizationId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Marketing</h1>
        <p className="text-muted-foreground text-sm">
          Social Media Manager, Content Creator, and Ad Creative worker
          agents land here in Phase 3. Social posts stay DRAFT — no
          automatic publishing until LIVE mode and explicit approval.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaigns</CardTitle>
          <CardDescription>{campaigns.length} campaigns</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Leads generated</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Cost / lead</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.platform}</TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
                  </TableCell>
                  <TableCell>{c.leads_generated}</TableCell>
                  <TableCell>{formatInr(Number(c.cost_inr))}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.leads_generated > 0
                      ? formatInr(Number(c.cost_inr) / c.leads_generated)
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Social Content</CardTitle>
          <CardDescription>{posts.length} posts (draft/scheduled/published)</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {posts.map((p) => (
            <div key={p.id} className="border-border flex flex-col gap-1 rounded-md border p-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{p.platform}</span>
                <StatusBadge status={p.status} />
              </div>
              <p className="text-sm">{p.caption}</p>
              <p className="text-muted-foreground text-xs">
                {p.scheduled_at
                  ? `Scheduled ${formatDateTime(p.scheduled_at)}`
                  : `Drafted ${formatDateTime(p.created_at)}`}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
