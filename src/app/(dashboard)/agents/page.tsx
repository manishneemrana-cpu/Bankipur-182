import { getCurrentUser } from "@/lib/data/current-user";
import { getAgents, getAgentOutputs } from "@/lib/data/agents";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime } from "@/lib/format";

const DEPARTMENT_LABEL: Record<string, string> = {
  real_estate: "Chief Real Estate Officer",
  marketing: "Chief Marketing Officer",
  automation: "Chief Automation Officer",
  finance_legal: "Chief Financial & Legal Officer",
};

const DEPARTMENTS = ["real_estate", "marketing", "automation", "finance_legal"] as const;

function usd(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export default async function AgentsPage() {
  const user = await getCurrentUser();
  if (!user.organizationId) return null;

  const [agents, outputs] = await Promise.all([
    getAgents(user.organizationId),
    getAgentOutputs(user.organizationId),
  ]);

  const ceo = agents.find((a) => a.tier === "ceo");
  const heads = agents.filter((a) => a.tier === "head");
  const workers = agents.filter((a) => a.tier === "worker");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Agent Registry</h1>
        <p className="text-muted-foreground text-sm">
          CEO Agent → 4 Head Agents → 25 Worker Agents. Registry metadata
          only — the Worker → Head → CEO review chain and approval engine
          land in Phase 4. Every output follows the Standard Agent Output
          Contract below.
        </p>
      </div>

      {ceo && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{ceo.name}</CardTitle>
              <StatusBadge status={ceo.status} />
              <Badge variant="outline">{ceo.model}</Badge>
            </div>
            <CardDescription>{ceo.description}</CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {DEPARTMENTS.map((dept) => {
          const head = heads.find((h) => h.department === dept);
          const deptWorkers = workers.filter((w) => w.department === dept);
          return (
            <Card key={dept}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">
                    {head?.name ?? DEPARTMENT_LABEL[dept]}
                  </CardTitle>
                  {head && <StatusBadge status={head.status} />}
                </div>
                <CardDescription>{head?.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {deptWorkers.map((w) => (
                  <div
                    key={w.id}
                    className="border-border flex items-center justify-between rounded-md border p-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{w.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {w.model} · max {usd(w.max_cost_usd)}/task · {w.max_runtime_seconds}s
                      </p>
                    </div>
                    <StatusBadge status={w.status} />
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sample Agent Outputs</CardTitle>
          <CardDescription>
            Illustrative outputs following the Standard Agent Output
            Contract — static demo content, not live AI calls.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {outputs.map((o) => {
            const agent = o.agents as unknown as { name: string } | null;
            return (
              <div key={o.id} className="border-border flex flex-col gap-2 rounded-md border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{agent?.name}</span>
                  <Badge variant="outline">{o.department.replace("_", " ")}</Badge>
                  <StatusBadge status={o.status} />
                  <Badge variant={o.requires_approval ? "warning" : "outline"}>
                    {o.requires_approval ? "requires approval" : "no approval needed"}
                  </Badge>
                  <span className="text-muted-foreground ml-auto text-xs">
                    confidence {o.confidence}% · {usd(o.estimated_cost_usd)} est. cost ·{" "}
                    {formatDateTime(o.created_at)}
                  </span>
                </div>
                <p className="text-sm font-medium">{o.task}</p>

                <ContractSection label="FACT" tone="fact" items={o.fact as string[]} />
                <ContractSection label="OBSERVATION" tone="observation" items={o.observation as string[]} />
                <ContractSection label="INFERENCE" tone="inference" items={o.inference as string[]} />
                <ContractSection
                  label="RECOMMENDATION"
                  tone="recommendation"
                  items={o.recommendation as string[]}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function ContractSection({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: "fact" | "observation" | "inference" | "recommendation";
}) {
  if (items.length === 0) return null;

  const toneClass = {
    fact: "border-l-success",
    observation: "border-l-muted-foreground",
    inference: "border-l-warning",
    recommendation: "border-l-primary",
  }[tone];

  return (
    <div className={`border-l-2 ${toneClass} pl-3`}>
      <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
        {label}
      </p>
      <ul className="list-disc pl-4 text-sm">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
