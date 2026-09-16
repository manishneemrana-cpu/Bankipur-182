import { getCurrentUser } from "@/lib/data/current-user";
import { getAgentOutputsForReview } from "@/lib/data/approvals";
import { availableActions, TRANSITIONS, DECISION_MAKER_ROLES } from "@/lib/agents/state-machine";
import type { AgentOutputStatus } from "@/lib/agents/contract";
import { transitionAgentOutput } from "./actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";

const PENDING: AgentOutputStatus[] = ["draft", "waiting_head_review", "head_approved", "escalated_to_ceo"];
const APPROVED: AgentOutputStatus[] = ["approved", "executing", "completed"];
const REJECTED: AgentOutputStatus[] = ["head_rejected", "rejected"];
const FAILED: AgentOutputStatus[] = ["failed"];

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await getCurrentUser();
  if (!user.organizationId) return null;

  const outputs = await getAgentOutputsForReview(user.organizationId);
  const canDecide = DECISION_MAKER_ROLES.includes(user.role as (typeof DECISION_MAKER_ROLES)[number]);

  const buckets: { label: string; description: string; items: typeof outputs }[] = [
    {
      label: "Pending",
      description: "Awaiting a Head or CEO decision.",
      items: outputs.filter((o) => PENDING.includes(o.status)),
    },
    {
      label: "Approved",
      description: "Approved, executing, or completed.",
      items: outputs.filter((o) => APPROVED.includes(o.status)),
    },
    {
      label: "Rejected",
      description: "Rejected at Head or CEO review.",
      items: outputs.filter((o) => REJECTED.includes(o.status)),
    },
    {
      label: "Failed",
      description: "Approved and executed, but failed.",
      items: outputs.filter((o) => FAILED.includes(o.status)),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Approvals</h1>
        <p className="text-muted-foreground text-sm">
          Two-stage Worker → Head → CEO review chain. Nothing moves to
          EXECUTING without an explicit approval decision below.
          {!canDecide && " Your role (" + user.role + ") can view but not act — only OWNER/ADMIN/EXECUTIVE record decisions."}
        </p>
        {error && (
          <p className="text-destructive mt-2 text-sm">{decodeURIComponent(error)}</p>
        )}
      </div>

      {buckets.map((bucket) => (
        <Card key={bucket.label}>
          <CardHeader>
            <CardTitle className="text-base">{bucket.label}</CardTitle>
            <CardDescription>
              {bucket.description} ({bucket.items.length})
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {bucket.items.length === 0 && (
              <p className="text-muted-foreground text-sm">Nothing here.</p>
            )}
            {bucket.items.map((o) => {
              const agent = o.agents as unknown as { name: string } | null;
              const actions = canDecide ? availableActions(o.status) : [];
              return (
                <div key={o.id} className="border-border flex flex-col gap-2 rounded-md border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{agent?.name}</span>
                    <Badge variant="outline">{o.department.replace("_", " ")}</Badge>
                    <StatusBadge status={o.status} />
                    <span className="text-muted-foreground ml-auto text-xs">
                      confidence {o.confidence}% · {formatDateTime(o.created_at)}
                    </span>
                  </div>
                  <p className="text-sm">{o.task}</p>
                  {(o.recommendation as string[]).length > 0 && (
                    <p className="text-muted-foreground text-sm">
                      <span className="font-medium">Recommendation: </span>
                      {(o.recommendation as string[]).join(" ")}
                    </p>
                  )}

                  {actions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      {actions.map((action) => (
                        <form key={action} action={transitionAgentOutput} className="flex items-center gap-1">
                          <input type="hidden" name="outputId" value={o.id} />
                          <input type="hidden" name="action" value={action} />
                          <Input
                            name="notes"
                            placeholder="Optional note"
                            className="h-8 w-36 text-xs"
                          />
                          <Button
                            type="submit"
                            size="sm"
                            variant={
                              action.includes("reject") || action === "mark_failed"
                                ? "destructive"
                                : "default"
                            }
                          >
                            {TRANSITIONS[action].label}
                          </Button>
                        </form>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
