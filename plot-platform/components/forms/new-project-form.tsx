"use client";

import { useActionState } from "react";

import {
  createProject,
  type ActionState,
} from "@/app/(admin)/dashboard/projects/actions";

const initialState: ActionState = {};

export function NewProjectForm() {
  const [state, formAction, pending] = useActionState(
    createProject,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-3 rounded-md border p-4"
    >
      <label className="flex flex-col gap-1 text-sm">
        Project name
        <input
          name="name"
          required
          placeholder="Green Valley Enclave"
          className="h-9 rounded-md border border-input px-3"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        City
        <input
          name="city"
          className="h-9 rounded-md border border-input px-3"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        State
        <input
          name="state"
          className="h-9 rounded-md border border-input px-3"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create project"}
      </button>
      {state.error ? (
        <p className="w-full text-sm text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}
