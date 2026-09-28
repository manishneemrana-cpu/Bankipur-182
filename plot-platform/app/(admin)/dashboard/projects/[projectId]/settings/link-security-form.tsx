"use client";

import { useActionState, useState } from "react";

import { updateLinkSecurity, type ActionState } from "./actions";

const initialState: ActionState = {};

export function LinkSecurityForm({
  projectId,
  visibility,
  linkDisabled,
  linkExpiresAt,
}: {
  projectId: string;
  visibility: string;
  linkDisabled: boolean;
  linkExpiresAt: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    updateLinkSecurity.bind(null, projectId),
    initialState,
  );
  const [selected, setSelected] = useState(visibility);

  return (
    <form action={formAction} className="flex flex-col gap-3 text-sm">
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-xs text-muted-foreground">
          Visibility
        </legend>
        {(["public", "unlisted", "password"] as const).map((v) => (
          <label key={v} className="flex items-center gap-2">
            <input
              type="radio"
              name="visibility"
              value={v}
              checked={selected === v}
              onChange={() => setSelected(v)}
            />
            {v}
          </label>
        ))}
      </fieldset>

      {selected === "password" ? (
        <label className="flex flex-col gap-1">
          New password (min 6 chars, leave blank to keep current)
          <input
            name="password"
            type="password"
            minLength={6}
            className="h-9 rounded-md border border-input px-3"
          />
        </label>
      ) : null}

      <label className="flex flex-col gap-1">
        Link expires at (optional)
        <input
          name="link_expires_at"
          type="datetime-local"
          defaultValue={linkExpiresAt ? linkExpiresAt.slice(0, 16) : ""}
          className="h-9 rounded-md border border-input px-3"
        />
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="link_disabled"
          defaultChecked={linkDisabled}
        />
        Kill switch: disable the public link instantly
      </label>

      {state.error ? <p className="text-destructive">{state.error}</p> : null}
      {state.success ? <p className="text-success-foreground">Saved.</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
