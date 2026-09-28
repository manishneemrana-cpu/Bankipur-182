"use client";

import { useActionState } from "react";

import { createOrg, type ActionState } from "./actions";

const initialState: ActionState = {};

// A signed-in user with no org yet lands here (e.g. after email confirmation
// broke the signup flow's session — see signup/actions.ts). Outside the
// dashboard layout so its own-org guard cannot redirect back here in a loop.
export default function SetupOrgPage() {
  const [state, formAction, pending] = useActionState(createOrg, initialState);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        Set up your organization
      </h1>
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Company name
          <input
            name="orgName"
            required
            placeholder="Demo Builders"
            className="h-9 rounded-md border border-input px-3"
          />
        </label>
        {state.error ? (
          <p className="text-sm text-destructive">{state.error}</p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-md bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create organization"}
        </button>
      </form>
    </main>
  );
}
