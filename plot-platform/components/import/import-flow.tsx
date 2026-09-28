"use client";

import { useActionState } from "react";

import {
  applyImport,
  validateImport,
  type ValidateState,
} from "@/app/(admin)/dashboard/projects/[projectId]/import/actions";

const initialState: ValidateState = {};

export function ImportFlow({ projectId }: { projectId: string }) {
  const [state, validateAction, validating] = useActionState(
    validateImport.bind(null, projectId),
    initialState,
  );
  const [applyState, applyAction, applying] = useActionState(
    applyImport.bind(null, projectId, state.importId ?? ""),
    initialState,
  );

  const current = applyState.applied ? applyState : state;
  const errorRows = current.results?.filter((r) => r.errors.length > 0) ?? [];
  const okRows = current.results?.filter((r) => r.errors.length === 0) ?? [];

  return (
    <div className="flex flex-col gap-4">
      {!current.results ? (
        <form action={validateAction} className="flex items-center gap-3">
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="text-sm"
          />
          <button
            type="submit"
            disabled={validating}
            className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {validating ? "Validating…" : "Validate"}
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            <span className="font-medium">{okRows.length}</span> rows ready,{" "}
            <span className="font-medium text-destructive">
              {errorRows.length}
            </span>{" "}
            with errors.
          </p>

          {errorRows.length > 0 ? (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left">
                    <th className="px-3 py-2 font-medium">Row</th>
                    <th className="px-3 py-2 font-medium">Plot</th>
                    <th className="px-3 py-2 font-medium">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {errorRows.map((r) => (
                    <tr key={r.row} className="border-b border-border">
                      <td className="px-3 py-2">{r.row}</td>
                      <td className="px-3 py-2">{r.plotNumber}</td>
                      <td className="px-3 py-2 text-destructive">
                        {r.errors.join("; ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {applyState.applied ? (
            <p className="text-success-foreground text-sm font-medium">
              Applied {applyState.validCount} rows.
            </p>
          ) : okRows.length > 0 ? (
            <form action={applyAction}>
              <button
                type="submit"
                disabled={applying}
                className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {applying
                  ? "Applying…"
                  : `Apply ${okRows.length} valid rows (skip the rest)`}
              </button>
            </form>
          ) : null}

          {applyState.error ? (
            <p className="text-sm text-destructive">{applyState.error}</p>
          ) : null}
          {state.error ? (
            <p className="text-sm text-destructive">{state.error}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
