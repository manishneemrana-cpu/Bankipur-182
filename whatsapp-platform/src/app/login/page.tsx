import { login } from "@/server/actions/auth-actions";
import { redirect } from "next/navigation";

export default function LoginPage() {
  async function loginAction(formData: FormData) {
    "use server";
    const result = await login({
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (result.ok) redirect("/dashboard");
    redirect(`/login?error=${encodeURIComponent(result.error ?? "Login failed")}`);
  }

  return (
    <main className="mx-auto max-w-sm px-6 py-16">
      <h1 className="text-xl font-semibold">Log in</h1>
      <form action={loginAction} className="mt-6 flex flex-col gap-3">
        <input
          name="email"
          type="email"
          placeholder="you@company.com"
          required
          className="rounded-md border border-slate-300 px-3 py-2"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          className="rounded-md border border-slate-300 px-3 py-2"
        />
        <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-white">
          Log in
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        No account yet? <a href="/register" className="underline">Register your organization</a>
      </p>
    </main>
  );
}
