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
  { label: "Agent Registry", href: "/agents", phase: "upcoming", phaseLabel: "Phase 3" },
  { label: "Approvals", href: "/approvals", phase: "upcoming", phaseLabel: "Phase 4" },
  { label: "Audit Logs", href: "/audit-logs", phase: "upcoming", phaseLabel: "Phase 4" },
  { label: "AI Cost Monitoring", href: "/ai-cost", phase: "upcoming", phaseLabel: "Phase 3+" },
  { label: "System Health", href: "/system-health", phase: "upcoming", phaseLabel: "Phase 5+" },
];
