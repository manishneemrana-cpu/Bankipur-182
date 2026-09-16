import { Badge } from "@/components/ui/badge";
import type { AppEnvironment } from "@/lib/types";

export function ModeBadge({ mode }: { mode: AppEnvironment | null }) {
  if (!mode) {
    return <Badge variant="outline">No organization</Badge>;
  }

  const variant = mode === "live" ? "destructive" : mode === "test" ? "warning" : "success";

  return <Badge variant={variant}>{mode.toUpperCase()} MODE</Badge>;
}
