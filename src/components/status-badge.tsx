import type { VariantProps } from "class-variance-authority";

import { Badge, badgeVariants } from "@/components/ui/badge";

type Variant = VariantProps<typeof badgeVariants>["variant"];

const STATUS_VARIANTS: Record<string, Variant> = {
  active: "success",
  hot: "destructive",
  warm: "warning",
  new: "outline",
  nurture: "secondary",
  qualified: "success",
  converted: "success",
  lost: "outline",
  pending: "warning",
  overdue: "destructive",
  completed: "success",
  scheduled: "outline",
  cancelled: "outline",
  sold: "secondary",
  inactive: "outline",
  draft: "outline",
  published: "success",
  paused: "warning",
  open: "outline",
  in_progress: "warning",
  done: "success",
};

export function StatusBadge({ status }: { status: string }) {
  const variant = STATUS_VARIANTS[status] ?? "outline";
  return <Badge variant={variant}>{status.replace(/_/g, " ")}</Badge>;
}
