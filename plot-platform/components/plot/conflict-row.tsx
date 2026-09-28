"use client";

import { useState, useTransition } from "react";

import { resolveConflict } from "@/app/(admin)/dashboard/projects/[projectId]/conflicts/actions";

interface ConflictValue {
  source: string;
  value: unknown;
}

export function ConflictRow({
  projectId,
  conflict,
}: {
  projectId: string;
  conflict: {
    id: string;
    field: string;
    note: string | null;
    values: ConflictValue[];
    plotNumber: string | null;
  };
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);

  function resolve(value: unknown) {
    setError(null);
    startTransition(async () => {
      const result = await resolveConflict(
        projectId,
        conflict.id,
        JSON.stringify(value),
        null,
      );
      if (result.error) setError(result.error);
      else setResolved(true);
    });
  }

  if (resolved) return null;

  return (
    <li className="rounded-md border p-4">
      <p className="text-sm font-medium">
        {conflict.plotNumber ?? "No plot"} · {conflict.field}
      </p>
      {conflict.note ? (
        <p className="text-sm text-muted-foreground">{conflict.note}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {conflict.values.map((v, i) => (
          <button
            key={i}
            type="button"
            disabled={pending}
            onClick={() => resolve(v.value)}
            className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          >
            {v.source}: {String(v.value)}
          </button>
        ))}
        <button
          type="button"
          disabled={pending}
          onClick={() => resolve(null)}
          className="rounded-md border border-dashed px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent disabled:opacity-50"
        >
          Record as resolved, keep current value
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </li>
  );
}
