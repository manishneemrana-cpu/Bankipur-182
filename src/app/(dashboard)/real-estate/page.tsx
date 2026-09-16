import { getCurrentUser } from "@/lib/data/current-user";
import {
  getProperties,
  getLeads,
  getBrokers,
  getBuilders,
  getFollowups,
  getSiteVisits,
} from "@/lib/data/dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatInr, formatDateTime } from "@/lib/format";

export default async function RealEstateOpsPage() {
  const user = await getCurrentUser();
  if (!user.organizationId) return null;

  const [properties, leads, brokers, builders, followups, siteVisits] = await Promise.all([
    getProperties(user.organizationId),
    getLeads(user.organizationId),
    getBrokers(user.organizationId),
    getBuilders(user.organizationId),
    getFollowups(user.organizationId),
    getSiteVisits(user.organizationId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Real Estate Ops</h1>
        <p className="text-muted-foreground text-sm">
          Property Listing Manager, Sales/Lead, Follow-up, Site Visit,
          Broker, and Builder worker agents land here in Phase 3.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Properties</CardTitle>
          <CardDescription>{properties.length} listings</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Verification</TableHead>
                <TableHead>Listed by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {properties.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell>{p.property_type}</TableCell>
                  <TableCell>
                    {p.locality}, {p.city}
                  </TableCell>
                  <TableCell>{formatInr(Number(p.price_inr))}</TableCell>
                  <TableCell>
                    <StatusBadge status={p.status} />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{p.verification_tier}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.listed_by}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leads</CardTitle>
          <CardDescription>{leads.length} leads</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Assigned to</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => {
                const property = lead.properties as unknown as { title: string } | null;
                return (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell>{lead.source}</TableCell>
                    <TableCell>
                      <StatusBadge status={lead.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {property?.title ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {lead.assigned_to ?? "Unassigned"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(lead.created_at)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Follow-ups</CardTitle>
            <CardDescription>{followups.length} tracked</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Channel</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {followups.map((f) => {
                  const lead = f.leads as unknown as { name: string } | null;
                  return (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{lead?.name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(f.due_at)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={f.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{f.channel}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Site Visits</CardTitle>
            <CardDescription>{siteVisits.length} scheduled/completed</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {siteVisits.map((v) => {
                  const lead = v.leads as unknown as { name: string } | null;
                  const property = v.properties as unknown as { title: string } | null;
                  return (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{lead?.name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {property?.title ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(v.scheduled_at)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={v.status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Brokers</CardTitle>
            <CardDescription>{brokers.length} on record</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Leads</TableHead>
                  <TableHead>Conversions</TableHead>
                  <TableHead>Avg. response</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {brokers.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell>
                      <Badge variant={b.is_active ? "success" : "outline"}>
                        {b.is_active ? "active" : "inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>{b.leads_count}</TableCell>
                    <TableCell>{b.conversions}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {b.avg_response_hours ? `${b.avg_response_hours}h` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Builders</CardTitle>
            <CardDescription>{builders.length} partners</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Projects</TableHead>
                  <TableHead>Active enquiries</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {builders.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell>{b.projects_count}</TableCell>
                    <TableCell>{b.active_enquiries}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
