import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Webhook,
  Activity,
  Layers,
  FileClock,
  type LucideIcon,
} from "lucide-react";

export const ADMIN_NAV: ReadonlyArray<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/organizations", label: "Organizations", icon: Building2 },
  { href: "/admin/billing", label: "Billing", icon: CreditCard },
  { href: "/admin/webhooks", label: "Webhooks", icon: Webhook },
  { href: "/admin/system-health", label: "System Health", icon: Activity },
  { href: "/admin/plans", label: "Plans", icon: Layers },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: FileClock },
];
