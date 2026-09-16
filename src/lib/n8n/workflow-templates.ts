export type WorkflowTemplate = {
  key: string;
  name: string;
  description: string;
  triggerEvent: string;
  externalAction: boolean;
  department: "real_estate" | "marketing" | "automation" | "finance_legal" | "executive";
};

/**
 * The 8 workflow templates from the master spec. These are documentation/
 * config only in Phase 5 - no live n8n instance exists to import them
 * into, and none of them execute anything in this build. externalAction
 * marks which ones the safety guard in safety.ts must gate in LIVE mode.
 */
export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    key: "new_property",
    name: "New Property",
    description: "Fires when a property is listed; notifies relevant brokers/builders.",
    triggerEvent: "properties.created",
    externalAction: false,
    department: "real_estate",
  },
  {
    key: "new_lead",
    name: "New Lead",
    description: "Fires when a lead is captured; routes to the Lead Qualifier Agent.",
    triggerEvent: "leads.created",
    externalAction: false,
    department: "real_estate",
  },
  {
    key: "lead_followup",
    name: "Lead Follow-up",
    description: "Sends a follow-up reminder/draft when a follow-up becomes due or overdue.",
    triggerEvent: "followups.due",
    externalAction: true,
    department: "real_estate",
  },
  {
    key: "site_visit",
    name: "Site Visit",
    description: "Sends a site visit confirmation/reminder to the lead.",
    triggerEvent: "site_visits.scheduled",
    externalAction: true,
    department: "real_estate",
  },
  {
    key: "social_draft",
    name: "Social Draft",
    description: "Pushes a Content Creator Agent draft into the review queue - never publishes.",
    triggerEvent: "social_posts.drafted",
    externalAction: false,
    department: "marketing",
  },
  {
    key: "daily_executive_report",
    name: "Daily Executive Report",
    description: "Compiles the day's department digests into one CEO Agent summary.",
    triggerEvent: "schedule.daily",
    externalAction: false,
    department: "executive",
  },
  {
    key: "system_health",
    name: "System Health",
    description: "Polls each integration and updates the system_health table.",
    triggerEvent: "schedule.hourly",
    externalAction: false,
    department: "automation",
  },
  {
    key: "ai_cost_alert",
    name: "AI Cost Alert",
    description: "Notifies the admin and stops non-essential AI calls when a cost limit is hit.",
    triggerEvent: "ai_cost.limit_reached",
    externalAction: true,
    department: "finance_legal",
  },
];

export function getWorkflowTemplate(key: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((t) => t.key === key);
}
