"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signup, type ActionState } from "./actions";

const initialState: ActionState = {};

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, initialState);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        Create your account
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
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="h-9 rounded-md border border-input px-3"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
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
          {pending ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </main>
  );
}
