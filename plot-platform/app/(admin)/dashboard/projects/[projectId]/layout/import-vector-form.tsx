"use client";

import { useActionState } from "react";

import {
  importVectorFile,
  type ImportVectorState,
} from "./import-vector-actions";

const initialState: ImportVectorState = {};

export function ImportVectorForm({ projectId }: { projectId: string }) {
  const [state, formAction, pending] = useActionState(
    importVectorFile.bind(null, projectId),
    initialState,
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-md border p-4"
    >
      <p className="text-sm font-medium">Already have vector data?</p>
      <label className="flex flex-col gap-1 text-sm">
        Import GeoJSON or KML
        <input
          name="file"
          type="file"
          accept=".geojson,.json,.kml,application/geo+json,application/vnd.google-earth.kml+xml"
          required
          className="text-sm"
        />
      </label>
      <p className="text-xs text-muted-foreground">
        Skips manual tracing — polygons import directly as plots (matched by
        name/plot_number), roads and zones. Requires the project&apos;s location
        (lat/lng) to be set in Settings first; DXF import isn&apos;t implemented
        in this build.
      </p>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md border border-input px-3 py-1.5 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "Importing…" : "Import"}
      </button>
    </form>
  );
}
