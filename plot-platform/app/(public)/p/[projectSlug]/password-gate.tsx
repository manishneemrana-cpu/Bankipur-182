"use client";

import { useActionState } from "react";

import { submitPassword, type PasswordState } from "./actions";

const initialState: PasswordState = {};

export function PasswordGate({ slug }: { slug: string }) {
  const [state, formAction, pending] = useActionState(
    submitPassword.bind(null, slug),
    initialState,
  );

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          This link is password-protected
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter the password shared with you to continue.
        </p>
      </div>
      <form action={formAction} className="flex flex-col gap-3">
        <input
          name="password"
          type="password"
          required
          autoFocus
          className="h-10 rounded-md border border-input px-3"
        />
        {state.error ? (
          <p className="text-sm text-destructive">{state.error}</p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-md bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Checking…" : "Continue"}
        </button>
      </form>
    </main>
  );
}
