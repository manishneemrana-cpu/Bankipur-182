import Link from "next/link";
import { redirect } from "next/navigation";
import { login } from "@/server/actions/auth-actions";
import { getEnv } from "@/server/env";
import { Logo } from "@/components/logo";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const env = getEnv();
  const { error } = await searchParams;

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
    <main className="flex min-h-screen flex-col items-center justify-center bg-ink-50 px-6 py-12">
      <Link href="/" className="mb-8">
        <Logo brandName={env.PLATFORM_BRAND_NAME} />
      </Link>

      <div className="card w-full max-w-sm p-8">
        <h1 className="text-lg font-semibold text-ink-900">Log in</h1>
        <p className="mt-1 text-sm text-ink-500">Welcome back — enter your details below.</p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        <form action={loginAction} className="mt-6 flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-700">Email</label>
            <input name="email" type="email" placeholder="you@company.com" required className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink-700">Password</label>
            <input name="password" type="password" placeholder="••••••••" required className="input-field" />
          </div>
          <button type="submit" className="btn-primary mt-2 w-full">
            Log in
          </button>
        </form>
      </div>

      <p className="mt-6 text-sm text-ink-500">
        No account yet?{" "}
        <Link href="/register" className="font-medium text-brand-700 hover:text-brand-800">
          Register your organization
        </Link>
      </p>
    </main>
  );
}
