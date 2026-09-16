export type NavItem = {
  label: string;
  href: string;
  phase: "live" | "upcoming";
  phaseLabel?: string;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Executive Overview", href: "/", phase: "live" },
  { label: "Real Estate Ops", href: "/real-estate", phase: "live" },
  { label: "Marketing", href: "/marketing", phase: "live" },
  { label: "Automation", href: "/automation", phase: "live" },
  { label: "Finance & Legal", href: "/finance-legal", phase: "live" },
  { label: "AI Insights", href: "/ai-insights", phase: "upcoming", phaseLabel: "Phase 3" },
  { label: "Agent Registry", href: "/agents", phase: "live" },
  { label: "Approvals", href: "/approvals", phase: "live" },
  { label: "Audit Logs", href: "/audit-logs", phase: "live" },
  { label: "AI Cost Monitoring", href: "/ai-cost", phase: "upcoming", phaseLabel: "Phase 3+" },
  { label: "System Health", href: "/system-health", phase: "live" },
];
