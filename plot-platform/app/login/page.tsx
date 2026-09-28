"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";

import { login, type ActionState } from "./actions";

const initialState: ActionState = {};

function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
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
          autoComplete="current-password"
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
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
      <p className="text-sm text-muted-foreground">
        No account?{" "}
        <Link href="/signup" className="underline underline-offset-4">
          Create one
        </Link>
      </p>
    </main>
  );
}
