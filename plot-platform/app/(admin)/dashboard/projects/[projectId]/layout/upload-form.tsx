"use client";

import { useActionState } from "react";

import { uploadLayout, type UploadState } from "./actions";

const initialState: UploadState = {};

export function UploadForm({ projectId }: { projectId: string }) {
  const [state, formAction, pending] = useActionState(
    uploadLayout.bind(null, projectId),
    initialState,
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-md border p-4"
    >
      <label className="flex flex-col gap-1 text-sm">
        Upload layout (PDF, PNG or JPG)
        <input
          name="file"
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          required
          className="text-sm"
        />
      </label>
      <p className="text-xs text-muted-foreground">
        PDF underlays aren&apos;t rendered in the tracing canvas yet — upload a
        PNG/JPG export of the layout page for the best tracing experience. The
        PDF is still stored and versioned either way.
      </p>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Uploading…" : "Upload"}
      </button>
    </form>
  );
}
