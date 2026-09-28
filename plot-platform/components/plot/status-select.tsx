"use client";

import { useState, useTransition } from "react";

import { changePlotStatus } from "@/app/(admin)/dashboard/projects/[projectId]/actions";

const STATUSES = [
  "NOT_RELEASED",
  "AVAILABLE",
  "HOLD",
  "RESERVED",
  "BOOKED",
  "SOLD",
  "BLOCKED",
  "UNAVAILABLE",
] as const;

// Backward moves and moves into/out of BLOCKED/UNAVAILABLE need a reason
// server-side (status_transition_rules); we always ask so the call never
// fails silently on REASON_REQUIRED.
export function PlotStatusSelect({
  projectId,
  plotId,
  status,
}: {
  projectId: string;
  plotId: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState(status);

  function onChange(next: string) {
    if (next === value) return;
    const reason = window.prompt(
      `Reason for changing ${value} → ${next} (optional):`,
    );
    if (reason === null) return; // user cancelled
    setError(null);
    startTransition(async () => {
      const result = await changePlotStatus(
        projectId,
        plotId,
        next,
        reason || null,
      );
      if (result.error) setError(result.error);
      else setValue(next);
    });
  }

  return (
    <div className="flex flex-col gap-0.5">
      <select
        value={value}
        disabled={pending}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-md border border-input bg-transparent px-2 text-xs disabled:opacity-50"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
